# Stripe Ödeme Entegrasyonu Kurulum Rehberi

Bu rehber, CulosAI projesinde Stripe ödeme entegrasyonunu kurmanız için adım adım talimatları içerir.

## 🎯 Genel Bakış

Stripe entegrasyonu şu bileşenleri içerir:
- **Backend API'leri**: Ödeme işlemleri ve webhook'lar
- **Frontend Formları**: Güvenli ödeme formları
- **Veritabanı Modelleri**: Ödeme ve token kayıtları
- **Webhook Handler'ları**: Gerçek zamanlı ödeme durumu takibi

## 📋 Ön Gereksinimler

1. **Stripe Hesabı**: [stripe.com](https://stripe.com)'da ücretsiz hesap oluşturun
2. **Node.js 18+**: Backend için gerekli
3. **MongoDB**: Veritabanı
4. **Stripe CLI**: Webhook testleri için (opsiyonel)

## 🔧 Adım 1: Stripe Hesabı Kurulumu

### 1.1 Stripe Dashboard'a Giriş
- [Stripe Dashboard](https://dashboard.stripe.com)'a gidin
- Test modunda olduğunuzdan emin olun (sağ üst köşede "Test mode" yazmalı)

### 1.2 API Anahtarlarını Alın
- Sol menüden **Developers > API keys**'e gidin
- **Publishable key** ve **Secret key**'i kopyalayın
- Bu anahtarları güvenli bir yerde saklayın

### 1.3 Webhook Endpoint Oluşturun
- **Developers > Webhooks**'a gidin
- **Add endpoint** butonuna tıklayın
- Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
- Events to send:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.dispute.created`

## 🔧 Adım 2: Backend Kurulumu

### 2.1 Ortam Değişkenlerini Ayarlayın
`backend/.env` dosyasını oluşturun:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Diğer gerekli değişkenler...
MONGO_URI=mongodb://localhost:27017/culosai
JWT_SECRET=your_jwt_secret
```

### 2.2 Bağımlılıkları Yükleyin
```bash
cd backend
npm install stripe
```

### 2.3 Veritabanı Modellerini Kontrol Edin
Payment modeli zaten mevcut. Gerekirse şu alanları ekleyin:
- `stripePaymentIntentId`
- `status` (pending, succeeded, failed, cancelled, disputed)
- `amount`, `currency`, `tokens`

## 🔧 Adım 3: Frontend Kurulumu

### 3.1 Ortam Değişkenlerini Ayarlayın
`frontend/.env.local` dosyasını oluşturun:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3.2 Bağımlılıkları Kontrol Edin
Stripe paketleri zaten yüklü:
- `@stripe/stripe-js`
- `@stripe/react-stripe-js`

### 3.3 Stripe Provider'ı Kurun
`buy-tokens/page.tsx` dosyasında Stripe Elements zaten kurulu.

## 🔧 Adım 4: Webhook Kurulumu

### 4.1 Stripe CLI Kurulumu (Opsiyonel)
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
# https://github.com/stripe/stripe-cli/releases

# Linux
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe
```

### 4.2 Webhook'ları Dinleyin
```bash
# Stripe CLI ile webhook'ları dinleyin
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# Bu komut size bir webhook secret verecek
# Bu secret'ı .env dosyasına ekleyin
```

## 🧪 Adım 5: Test Etme

### 5.1 Test Kartları
Aşağıdaki test kartlarını kullanın:

| Kart Numarası | Açıklama | Sonuç |
|---------------|----------|-------|
| 4242 4242 4242 4242 | Başarılı ödeme | ✅ Başarılı |
| 4000 0000 0000 0002 | Ödeme reddedildi | ❌ Başarısız |
| 4000 0000 0000 9995 | Yetersiz bakiye | ❌ Başarısız |
| 4000 0000 0000 9987 | Kayıp kart | ❌ Başarısız |

### 5.2 Test Senaryoları
1. **Başarılı Ödeme Testi**:
   - `/buy-tokens` sayfasına gidin
   - Bir paket seçin
   - Test kartı ile ödeme yapın
   - Tokenların hesaba eklendiğini kontrol edin

2. **Webhook Testi**:
   ```bash
   stripe trigger payment_intent.succeeded
   ```

3. **Ödeme Geçmişi Testi**:
   - `/payment-history` sayfasını kontrol edin
   - Ödeme kayıtlarının göründüğünü doğrulayın

## 🔒 Adım 6: Güvenlik Kontrolleri

### 6.1 Webhook Doğrulama
Webhook'ların doğru şekilde imzalandığından emin olun:
```javascript
// webhooks.js dosyasında
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### 6.2 Ödeme Durumu Kontrolü
Ödeme durumunu her zaman kontrol edin:
```javascript
if (paymentIntent.status !== 'succeeded') {
  return res.status(400).json({ message: 'Payment not completed' });
}
```

### 6.3 Duplicate İşlem Kontrolü
Aynı ödemenin birden fazla işlenmemesini sağlayın:
```javascript
if (payment.status === 'succeeded') {
  return res.status(400).json({ message: 'Payment already processed' });
}
```

## 🚀 Adım 7: Production'a Geçiş

### 7.1 Live Mode'a Geçin
1. Stripe Dashboard'da **Test mode**'u kapatın
2. Live API anahtarlarını alın
3. Environment değişkenlerini güncelleyin

### 7.2 SSL Sertifikası
Production'da HTTPS zorunludur:
```bash
# Nginx örneği
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ...
}
```

### 7.3 Webhook URL'ini Güncelleyin
Production webhook URL'ini Stripe Dashboard'da güncelleyin:
```
https://yourdomain.com/api/webhooks/stripe
```

## 📊 Monitoring ve Logging

### 8.1 Stripe Dashboard
- **Payments**: Tüm ödemeleri görüntüleyin
- **Logs**: API çağrılarını takip edin
- **Webhooks**: Webhook başarı/başarısızlık oranlarını izleyin

### 8.2 Uygulama Logları
```javascript
// Ödeme başarılı
console.log(`Payment successful: ${payment.tokens} tokens added to user ${user._id}`);

// Hata durumu
console.error('Error handling payment success:', error);
```

## 🐛 Sorun Giderme

### Yaygın Sorunlar

1. **Webhook Alınmıyor**:
   - Webhook secret'ı kontrol edin
   - URL'in doğru olduğundan emin olun
   - SSL sertifikasını kontrol edin

2. **Ödeme Başarısız**:
   - Test kartlarını kullandığınızdan emin olun
   - Stripe Dashboard'da hata mesajlarını kontrol edin
   - API anahtarlarının doğru olduğunu kontrol edin

3. **Tokenlar Eklenmiyor**:
   - Webhook'ların çalıştığını kontrol edin
   - Veritabanı bağlantısını kontrol edin
   - User modelinde tokens alanının olduğunu kontrol edin

### Debug Komutları
```bash
# Stripe CLI ile webhook'ları test edin
stripe trigger payment_intent.succeeded

# API çağrılarını izleyin
stripe logs tail

# Test ödemesi oluşturun
stripe payment_intents create --amount=999 --currency=usd
```

## 📞 Destek

- **Stripe Dokümantasyonu**: [stripe.com/docs](https://stripe.com/docs)
- **Stripe Support**: [support.stripe.com](https://support.stripe.com)
- **GitHub Issues**: Proje repository'sinde issue açın

## ✅ Kontrol Listesi

- [ ] Stripe hesabı oluşturuldu
- [ ] API anahtarları alındı
- [ ] Webhook endpoint oluşturuldu
- [ ] Environment değişkenleri ayarlandı
- [ ] Backend bağımlılıkları yüklendi
- [ ] Frontend bağımlılıkları yüklendi
- [ ] Test kartları ile ödeme test edildi
- [ ] Webhook'lar test edildi
- [ ] Ödeme geçmişi kontrol edildi
- [ ] Güvenlik kontrolleri yapıldı
- [ ] Production ortamı hazırlandı

---

**Not**: Bu rehber test ortamı için hazırlanmıştır. Production'a geçmeden önce ek güvenlik önlemleri alınmalıdır. 