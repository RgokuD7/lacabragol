/**
 * Firebase Cloud Functions (v2) - La Cabra Gol
 * Sistema de Notificaciones Push Web (FCM) Event-Driven
 */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, FieldPath } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Inicializar SDK de Firebase Admin
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

/**
 * Utilidad: Limpia tokens FCM inválidos o expirados de los documentos de usuarios
 */
async function pruneInvalidTokens(tokens, responses) {
  const tokensToRemove = [];
  responses.forEach((resp, idx) => {
    if (!resp.success && resp.error) {
      const code = resp.error.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        tokensToRemove.push(tokens[idx]);
      }
    }
  });

  if (tokensToRemove.length === 0) return;

  console.log(`[FCM] Limpiando ${tokensToRemove.length} tokens inválidos...`);

  try {
    const usersSnap = await db.collection("users")
      .where("fcmTokens", "array-contains-any", tokensToRemove.slice(0, 30))
      .get();

    const batch = db.batch();
    usersSnap.forEach((doc) => {
      batch.update(doc.ref, {
        fcmTokens: FieldValue.arrayRemove(...tokensToRemove)
      });
    });
    await batch.commit();
  } catch (err) {
    console.error("[FCM] Error al remover tokens inválidos:", err);
  }
}

/**
 * 1. NOTIFICACIÓN DE CHAT
 * Escucha la creación de nuevos mensajes en la colección 'messages'
 * Notifica a todos los miembros del grupo excepto al remitente.
 */
exports.notifyNewChatMessage = onDocumentCreated(
  {
    document: "messages/{messageId}",
    region: "us-central1"
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("[ChatPush] Documento no disponible.");
      return;
    }

    const messageData = snap.data();
    const { userId: senderId, userName = "Un participante", text = "", groupId } = messageData;
    const messageId = event.params.messageId;

    console.log(`[ChatPush] Nuevo mensaje de ${userName} (${senderId}) en grupo ${groupId}`);

    try {
      let targetUserIds = [];

      // Si el mensaje pertenece a un grupo, obtener los miembros del grupo
      if (groupId) {
        const groupDoc = await db.collection("groups").doc(groupId).get();
        if (groupDoc.exists) {
          const group = groupDoc.data();
          targetUserIds = (group.members || []).filter((id) => id !== senderId);
        }
      }

      // Si no hay miembros filtrados, buscar usuarios activos que no sean el remitente
      if (targetUserIds.length === 0) {
        const usersSnap = await db.collection("users").limit(100).get();
        usersSnap.forEach((doc) => {
          if (doc.id !== senderId) {
            targetUserIds.push(doc.id);
          }
        });
      }

      if (targetUserIds.length === 0) {
        console.log("[ChatPush] No hay destinatarios para notificar.");
        return;
      }

      // Obtener los tokens FCM de los destinatarios (en lotes de 30 para Firestore 'in')
      const targetTokens = [];
      for (let i = 0; i < targetUserIds.length; i += 30) {
        const chunk = targetUserIds.slice(i, i + 30);
        if (chunk.length === 0) continue;

        const usersSnap = await db.collection("users")
          .where(FieldPath.documentId(), "in", chunk)
          .get();

        usersSnap.forEach((doc) => {
          const u = doc.data();
          if (Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0) {
            targetTokens.push(...u.fcmTokens);
          }
        });
      }

      const uniqueTokens = [...new Set(targetTokens)].filter(Boolean);
      if (uniqueTokens.length === 0) {
        console.log("[ChatPush] Ningún usuario destinatario tiene tokens FCM registrados.");
        return;
      }

      console.log(`[ChatPush] Enviando notificación a ${uniqueTokens.length} dispositivos...`);

      const cleanText = text.length > 90 ? text.substring(0, 87) + "..." : text;

      // Construir payload multicast para Web Push
      const payload = {
        tokens: uniqueTokens,
        notification: {
          title: `Nuevo mensaje de ${userName}`,
          body: cleanText || "Nuevo mensaje recibido en el chat"
        },
        data: {
          type: "chat",
          groupId: groupId || "",
          messageId: messageId,
          url: "/?tab=chat"
        },
        webpush: {
          fcmOptions: {
            link: "/?tab=chat"
          },
          notification: {
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
            tag: `chat-${groupId || "general"}`
          }
        }
      };

      const response = await messaging.sendEachForMulticast(payload);
      console.log(`[ChatPush] Notificaciones enviadas. Éxito: ${response.successCount}, Fallos: ${response.failureCount}`);

      if (response.failureCount > 0) {
        await pruneInvalidTokens(uniqueTokens, response.responses);
      }
    } catch (error) {
      console.error("[ChatPush] Error al procesar notificación de chat:", error);
    }
  }
);

/**
 * Utilidad: Envía notificación masiva de actualización del Ranking a todos los usuarios
 */
async function broadcastRankingNotification(customBody) {
  try {
    const usersSnap = await db.collection("users").get();
    const tokens = [];

    usersSnap.forEach((doc) => {
      const u = doc.data();
      if (Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0) {
        tokens.push(...u.fcmTokens);
      }
    });

    const uniqueTokens = [...new Set(tokens)].filter(Boolean);
    if (uniqueTokens.length === 0) {
      console.log("[RankingPush] No hay tokens FCM registrados.");
      return;
    }

    console.log(`[RankingPush] Notificando ranking a ${uniqueTokens.length} dispositivos...`);

    const payload = {
      tokens: uniqueTokens,
      notification: {
        title: "¡El ranking ha sido actualizado! 🏆",
        body: customBody || "¡El ranking ha sido actualizado! Revisa tu posición."
      },
      data: {
        type: "ranking",
        url: "/?tab=ranking"
      },
      webpush: {
        fcmOptions: {
          link: "/?tab=ranking"
        },
        notification: {
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          tag: "ranking-update"
        }
      }
    };

    const response = await messaging.sendEachForMulticast(payload);
    console.log(`[RankingPush] Éxito: ${response.successCount}, Fallos: ${response.failureCount}`);

    if (response.failureCount > 0) {
      await pruneInvalidTokens(uniqueTokens, response.responses);
    }
  } catch (err) {
    console.error("[RankingPush] Error en broadcast de ranking:", err);
  }
}

/**
 * 2. NOTIFICACIÓN DE RANKING (Disparador por finalización de partido)
 * Escucha cambios en 'matches/{matchId}' y cuando un partido pasa a 'finished',
 * dispara la notificación de ranking actualizado a todos los usuarios.
 */
exports.notifyRankingOnMatchFinished = onDocumentUpdated(
  {
    document: "matches/{matchId}",
    region: "us-central1"
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    if (!beforeData || !afterData) return;

    // Detectar si el partido acaba de finalizar
    const justFinished = beforeData.status !== "finished" && afterData.status === "finished";
    // O si se marcó como sincronizado tras procesar puntos
    const justSynced = !beforeData.is_synced && afterData.is_synced === true;

    if (justFinished || justSynced) {
      const home = afterData.homeTeam || "Local";
      const away = afterData.awayTeam || "Visitante";
      const score = `${afterData.homeScore ?? 0} - ${afterData.awayScore ?? 0}`;

      console.log(`[RankingPush] Partido finalizado: ${home} ${score} ${away}. Disparando notificación de ranking.`);
      await broadcastRankingNotification(`¡Finalizó ${home} vs ${away}! El ranking ha sido actualizado. Revisa tu posición.`);
    }
  }
);

/**
 * 3. NOTIFICACIÓN DE RANKING (Disparador por flag global de sistema)
 * Escucha actualizaciones en 'system/ranking' para recálculos manuales o por lotes de la jornada
 */
exports.notifyRankingOnGlobalSync = onDocumentUpdated(
  {
    document: "system/ranking",
    region: "us-central1"
  },
  async (event) => {
    const beforeData = event.data?.before?.data() || {};
    const afterData = event.data?.after?.data() || {};

    // Si cambió el timestamp de recálculo o el flag de ranking actualizado
    if (afterData.updatedAt && afterData.updatedAt !== beforeData.updatedAt) {
      console.log("[RankingPush] Flag global system/ranking modificado. Enviando alerta masiva.");
      await broadcastRankingNotification("¡El ranking ha sido actualizado! Revisa tu posición.");
    }
  }
);
