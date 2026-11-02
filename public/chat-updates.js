// A full room response may have been prepared before the newest chat-only response.
export function mergeMessages(current = [], incoming = [], snapshot = false) {
 const newest = Math.max(0, ...incoming.map(message => message.id));
 const kept = snapshot ? current.filter(message => message.id > newest) : current;
 const messages = new Map(kept.map(message => [message.id, message]));
 for (const message of incoming) messages.set(message.id, message);
 return [...messages.values()].sort((a, b) => a.id - b.id).slice(-200);
}
