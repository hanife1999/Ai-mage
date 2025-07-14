# CulosAI - AI Image Generation Platform

CulosAI, kullanıcıların AI destekli görsel üretimi yapabileceği modern bir web uygulamasıdır. Stripe entegrasyonu ile güvenli ödeme işlemleri desteklenmektedir.

## 🚀 Özellikler

- **AI Görsel Üretimi**: Metin açıklamalarından görsel oluşturma
- **Token Sistemi**: Kullanım bazlı ödeme modeli
- **Stripe Ödeme Entegrasyonu**: Güvenli kredi kartı işlemleri
- **Kullanıcı Yönetimi**: Kayıt, giriş, profil yönetimi
- **Görsel Galerisi**: Üretilen görsellerin saklanması ve görüntülenmesi
- **Ödeme Geçmişi**: Tüm işlemlerin takibi

## 💳 Stripe Ödeme Entegrasyonu

### Özellikler
- **Güvenli Ödeme**: PCI DSS uyumlu Stripe entegrasyonu
- **Token Paketleri**: 4 farklı paket seçeneği
- **Webhook Desteği**: Gerçek zamanlı ödeme durumu takibi
- **Test Kartları**: Geliştirme için test kartları
- **Ödeme Geçmişi**: Detaylı işlem raporları

### Token Paketleri
- **Starter**: 50 tokens - $9.99
- **Popular**: 150 tokens - $24.99 (17% indirim)
- **Pro**: 500 tokens - $69.99 (30% indirim)
- **Enterprise**: 1500 tokens - $199.99 (33% indirim)

## 🛠️ Teknolojiler

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MongoDB** - Veritabanı
- **Mongoose** - ODM
- **Stripe** - Ödeme işlemcisi
- **JWT** - Kimlik doğrulama
- **AWS S3** - Dosya depolama

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Tip güvenliği
- **Tailwind CSS** - Styling
- **Stripe Elements** - Ödeme formu
- **React Context** - State yönetimi

## 📦 Kurulum

### Gereksinimler
- Node.js 18+
- MongoDB
- Stripe hesabı
- AWS S3 bucket (opsiyonel)

### 1. Repository'yi klonlayın
```bash
git clone <repository-url>
cd culosai
```

### 2. Backend kurulumu
```bash
cd backend
npm install
```

### 3. Frontend kurulumu
```bash
cd frontend
npm install
```

### 4. Ortam değişkenlerini ayarlayın

#### Backend (.env)
```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/culosai

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Server Configuration
PORT=5000
NODE_ENV=development

# AWS Configuration (for image storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_s3_bucket_name
```

#### Frontend (.env.local)
```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# App Configuration
NEXT_PUBLIC_APP_NAME=CulosAI
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Uygulamayı çalıştırın

#### Backend
```bash
cd backend
npm run dev
```

#### Frontend
```bash
cd frontend
npm run dev
```

## 🔧 Stripe Kurulumu

### 1. Stripe Hesabı Oluşturun
- [Stripe Dashboard](https://dashboard.stripe.com)'a gidin
- Test modunda API anahtarlarınızı alın

### 2. Webhook Kurulumu
```bash
# Stripe CLI kurulumu
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

### 3. Test Kartları
- **Başarılı Ödeme**: 4242 4242 4242 4242
- **Başarısız Ödeme**: 4000 0000 0000 0002
- **Yetersiz Bakiye**: 4000 0000 0000 9995

## 📁 Proje Yapısı

```
culosai/
├── backend/
│   ├── models/
│   │   ├── Payment.js      # Ödeme modeli
│   │   ├── Token.js        # Token işlemleri
│   │   └── User.js         # Kullanıcı modeli
│   ├── routes/
│   │   ├── payments.js     # Ödeme API'leri
│   │   └── webhooks.js     # Stripe webhook'ları
│   └── index.js
├── frontend/
│   ├── app/
│   │   ├── buy-tokens/     # Token satın alma
│   │   ├── payment-history/ # Ödeme geçmişi
│   │   └── payment-help/   # Ödeme yardımı
│   └── components/
└── README.md
```

## 🔒 Güvenlik

- **PCI DSS Uyumlu**: Stripe ile güvenli ödeme işleme
- **JWT Token**: Güvenli kimlik doğrulama
- **Input Validation**: Tüm kullanıcı girdileri doğrulanır
- **Rate Limiting**: API rate limiting (gelecek özellik)
- **HTTPS**: Production'da zorunlu

## 🧪 Test

### Ödeme Testleri
```bash
# Test kartları ile ödeme testi
curl -X POST http://localhost:5000/api/payments/create-payment-intent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"packageId": "starter"}'
```

### Webhook Testleri
```bash
# Stripe CLI ile webhook testi
stripe trigger payment_intent.succeeded
```

## 📊 Monitoring

- **Ödeme Durumu**: Real-time webhook takibi
- **Hata Logları**: Detaylı hata kayıtları
- **Performans**: API response time monitoring
- **Kullanım İstatistikleri**: Token kullanım analizi

## 🚀 Deployment

### Production Ortamı
1. **Environment Variables**: Production değerlerini ayarlayın
2. **Stripe**: Live mode'a geçin
3. **SSL**: HTTPS sertifikası kurun
4. **Database**: Production MongoDB cluster
5. **CDN**: Statik dosyalar için CDN

### Docker (Opsiyonel)
```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 Destek

- **Email**: hanifealtintas@gmail.com
- **Documentation**: golensoft
- **Issues**: GitHub Issues

## 🔄 Changelog

### v1.0.0
- İlk sürüm
- Stripe ödeme entegrasyonu
- Token sistemi
- AI görsel üretimi
- Kullanıcı yönetimi

---

**Not**: Bu proje geliştirme aşamasındadır. Production kullanımı için ek güvenlik önlemleri alınmalıdır. 
