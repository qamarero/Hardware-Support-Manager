/**
 * Construcción del enlace a una conversación de Intercom en el inbox.
 *
 * El workspace (app_id) es obligatorio en la URL; sin él, Intercom no abre la
 * conversación (te deja en el inbox genérico). El app_id NO es secreto: aparece
 * en cualquier URL del inbox.
 *
 * Formato real (verificado con una URL del workspace):
 *   https://app.intercom.com/a/inbox/{appId}/inbox/conversation/{conversationId}
 */
export const INTERCOM_APP_ID = "hckfnffg";

export function intercomConversationUrl(conversationId: string | null | undefined): string | null {
  const id = conversationId?.toString().trim();
  if (!id) return null;
  return `https://app.intercom.com/a/inbox/${INTERCOM_APP_ID}/inbox/conversation/${id}`;
}
