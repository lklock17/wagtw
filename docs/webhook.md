# Webhook Documentation

WAGTW dapat mengirimkan event real-time ke URL eksternal (server Anda) saat terjadi aktivitas pesan.

## Inbound Webhook (Pesan Masuk)

Saat ada pesan masuk ke nomor WhatsApp yang terhubung, server WAGTW akan mengirimkan `POST` request ke URL yang dikonfigurasi pada perangkat tersebut.

### Payload Example
```json
{
  "event": "message.received",
  "deviceId": "cl001...",
  "payload": {
    "from": "628123456789@c.us",
    "body": "Halo, saya mau tanya harga",
    "type": "chat",
    "timestamp": 165848293,
    "isGroup": false
  }
}
```

## Outbound Webhook (Status Pengiriman)

Digunakan untuk memantau apakah pesan yang Anda kirim via API telah terkirim atau gagal.

### Payload Example
```json
{
  "event": "message.status",
  "deviceId": "cl001...",
  "messageId": "msg_001...",
  "status": "SENT",
  "timestamp": 165848300
}
```
