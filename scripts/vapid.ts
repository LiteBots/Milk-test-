/** Generuje klucze VAPID do powiadomień push:  npm run vapid */
import webpush from 'web-push';

const k = webpush.generateVAPIDKeys();
console.log('Dodaj do zmiennych Railway:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${k.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`);
