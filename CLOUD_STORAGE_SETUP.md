# Cloud Storage (AWS S3) Kurulum Rehberi

Bu rehber, CulosAI projesinde AWS S3 cloud storage entegrasyonunu kurmanız için adım adım talimatları içerir.

## 🎯 Genel Bakış

AWS S3 entegrasyonu şu özellikleri sağlar:
- **Dosya Yükleme**: Güvenli dosya yükleme ve depolama
- **AI Görsel Depolama**: Üretilen görsellerin cloud'da saklanması
- **CDN Desteği**: Hızlı dosya erişimi
- **Ölçeklenebilirlik**: Sınırsız depolama kapasitesi
- **Güvenlik**: Dosya erişim kontrolü ve şifreleme

## 📋 Ön Gereksinimler

1. **AWS Hesabı**: [aws.amazon.com](https://aws.amazon.com)'da hesap oluşturun
2. **Node.js 18+**: Backend için gerekli
3. **AWS CLI**: Opsiyonel, yönetim için
4. **MongoDB**: Veritabanı

## 🔧 Adım 1: AWS S3 Bucket Oluşturma

### 1.1 AWS Console'a Giriş
- [AWS Console](https://console.aws.amazon.com)'a gidin
- S3 servisine gidin

### 1.2 Bucket Oluşturun
- **Create bucket** butonuna tıklayın
- Bucket name: `culosai-storage-{unique-id}` (benzersiz olmalı)
- Region: Size en yakın bölgeyi seçin (örn: us-east-1)
- Block Public Access: **Uncheck** (public read access için)
- Bucket Versioning: **Enable** (opsiyonel)
- Default Encryption: **Enable** (önerilen)

### 1.3 CORS Ayarları
Bucket oluşturduktan sonra CORS ayarlarını yapın:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
        "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
        "ExposeHeaders": ["ETag"]
    }
]
```

## 🔧 Adım 2: IAM Kullanıcısı Oluşturma

### 2.1 IAM Console'a Gidin
- AWS Console'da IAM servisine gidin
- **Users** > **Create user**

### 2.2 Kullanıcı Oluşturun
- Username: `culosai-s3-user`
- Access type: **Programmatic access**

### 2.3 İzinleri Ayarlayın
**Attach policies directly** seçin ve şu policy'yi ekleyin:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

### 2.4 Access Keys Alın
- **Access key ID** ve **Secret access key**'i kopyalayın
- Bu anahtarları güvenli bir yerde saklayın

## 🔧 Adım 3: Backend Kurulumu

### 3.1 Ortam Değişkenlerini Ayarlayın
`backend/.env` dosyasını güncelleyin:

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=culosai-storage-your-unique-id

# File Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB
MAX_FILES_PER_REQUEST=5
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,video/mp4,application/pdf
```

### 3.2 Bağımlılıkları Kontrol Edin
Gerekli paketler zaten yüklü:
- `aws-sdk`
- `multer`
- `multer-s3`

### 3.3 S3 Servisini Test Edin
```bash
cd backend
npm run dev
```

## 🔧 Adım 4: Frontend Kurulumu

### 4.1 Dosya Yükleme Sayfası
`/file-upload` sayfası zaten oluşturuldu ve çalışır durumda.

### 4.2 CORS Ayarları
Frontend'den S3'e direkt erişim için CORS ayarlarını kontrol edin.

## 🧪 Adım 5: Test Etme

### 5.1 Dosya Yükleme Testi
1. `/file-upload` sayfasına gidin
2. Bir dosya seçin ve yükleyin
3. AWS S3 Console'da dosyanın yüklendiğini kontrol edin

### 5.2 AI Görsel Testi
1. `/images` sayfasına gidin
2. Bir görsel üretin
3. S3'te `ai-images/` klasöründe görselin oluştuğunu kontrol edin

### 5.3 Dosya Silme Testi
1. Yüklenen dosyayı silin
2. S3'ten dosyanın silindiğini kontrol edin

## 🔒 Adım 6: Güvenlik Ayarları

### 6.1 Bucket Policy
Public read access için bucket policy ekleyin:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

### 6.2 Lifecycle Policy (Opsiyonel)
Eski dosyaları otomatik silmek için:

```json
{
    "Rules": [
        {
            "ID": "DeleteOldFiles",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "uploads/"
            },
            "Expiration": {
                "Days": 365
            }
        }
    ]
}
```

## 🚀 Adım 7: Production Ayarları

### 7.1 CloudFront CDN (Önerilen)
1. CloudFront distribution oluşturun
2. Origin domain: S3 bucket'ınızı seçin
3. Caching behavior ayarlayın
4. Custom domain ekleyin (opsiyonel)

### 7.2 Environment Variables
Production'da environment değişkenlerini güncelleyin:
```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=culosai-production-storage
```

### 7.3 Monitoring
- CloudWatch ile S3 kullanımını izleyin
- Billing alerts ayarlayın
- Access logs'ları etkinleştirin

## 📊 Monitoring ve Analytics

### 8.1 S3 Metrics
CloudWatch'da şu metrikleri izleyin:
- **BucketSizeBytes**: Depolama kullanımı
- **NumberOfObjects**: Dosya sayısı
- **AllRequests**: API çağrıları

### 8.2 Cost Optimization
- **S3 Intelligent Tiering**: Otomatik tier yönetimi
- **Lifecycle Policies**: Eski dosyaları arşivleme
- **Compression**: Dosya sıkıştırma

## 🐛 Sorun Giderme

### Yaygın Sorunlar

1. **CORS Hatası**:
   - Bucket CORS ayarlarını kontrol edin
   - Origin URL'lerini doğru ayarlayın

2. **Access Denied**:
   - IAM policy'yi kontrol edin
   - Access key'lerin doğru olduğunu kontrol edin

3. **Upload Başarısız**:
   - Dosya boyutu limitini kontrol edin
   - Dosya tipini kontrol edin
   - Network bağlantısını kontrol edin

4. **Dosya Silinmiyor**:
   - IAM policy'de DeleteObject iznini kontrol edin
   - Bucket policy'yi kontrol edin

### Debug Komutları
```bash
# AWS CLI ile bucket'ı test edin
aws s3 ls s3://your-bucket-name

# Dosya yükleme testi
aws s3 cp test.jpg s3://your-bucket-name/uploads/

# Dosya silme testi
aws s3 rm s3://your-bucket-name/uploads/test.jpg
```

## 💰 Maliyet Optimizasyonu

### S3 Storage Classes
- **Standard**: Sık erişilen dosyalar
- **IA (Infrequent Access)**: Az erişilen dosyalar
- **Glacier**: Arşiv dosyaları
- **Intelligent Tiering**: Otomatik optimizasyon

### Cost Estimation
- **Standard Storage**: $0.023/GB/ay
- **IA Storage**: $0.0125/GB/ay
- **Requests**: $0.0004/1000 requests
- **Data Transfer**: $0.09/GB (outbound)

## 📞 Destek

- **AWS S3 Dokümantasyonu**: [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3)
- **AWS Support**: [aws.amazon.com/support](https://aws.amazon.com/support)
- **GitHub Issues**: Proje repository'sinde issue açın

## ✅ Kontrol Listesi

- [ ] AWS hesabı oluşturuldu
- [ ] S3 bucket oluşturuldu
- [ ] CORS ayarları yapıldı
- [ ] IAM kullanıcısı oluşturuldu
- [ ] Access keys alındı
- [ ] Environment değişkenleri ayarlandı
- [ ] Dosya yükleme test edildi
- [ ] AI görsel test edildi
- [ ] Dosya silme test edildi
- [ ] Güvenlik ayarları yapıldı
- [ ] Production ortamı hazırlandı

---

**Not**: Bu rehber test ortamı için hazırlanmıştır. Production'a geçmeden önce ek güvenlik önlemleri alınmalıdır. 