# API Documentation

Base URL: `https://api.yourdomain.com/api`

## Authentication
Sertakan API Key Anda di header: `x-api-key: YOUR_API_KEY`

---

## 📱 Devices

### Get All Devices
`GET /devices`

### Create Device
`POST /devices`
Body: `{ "name": "Device Name" }`

---

## ✉️ Messaging

### Send Text Message
`POST /messages/send`
Body:
```json
{
  "deviceId": "device_id_here",
  "to": "628123456789",
  "text": "Hello world"
}
```

### Send Media (Image/Video/Document)
`POST /messages/send-media`
Body:
```json
{
  "deviceId": "device_id_here",
  "to": "628123456789",
  "url": "https://example.com/image.jpg",
  "caption": "Check this out",
  "type": "image"
}
```

---

## 📊 Status

### Check Device Status
`GET /devices/:id/status`
Returns: `CONNECTED`, `DISCONNECTED`, `QR_READY`.
