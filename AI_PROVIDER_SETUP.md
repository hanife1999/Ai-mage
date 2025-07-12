# AI Provider Setup Guide

Bu rehber, CulosAI projesinde farklı AI görsel üretim servislerini nasıl kuracağınızı ve yapılandıracağınızı açıklar.

## 🎯 Genel Bakış

CulosAI, esnek bir plugin sistemi ile farklı AI servislerini destekler:

- **Mock Provider**: Geliştirme ve test için
- **OpenAI DALL-E**: Yüksek kaliteli görsel üretimi
- **Stability AI**: Açık kaynak alternatifi
- **Custom Provider**: Özel AI servisleri için

## 📋 Desteklenen AI Servisleri

### 1. Mock Provider (Varsayılan)
- **Amaç**: Geliştirme ve test
- **Özellikler**: Gerçek API anahtarı gerektirmez
- **Maliyet**: Yok
- **Kalite**: Simüle edilmiş

### 2. OpenAI DALL-E
- **Amaç**: Yüksek kaliteli görsel üretimi
- **Özellikler**: DALL-E 2 ve DALL-E 3 desteği
- **Maliyet**: Token başına $0.02-$0.04
- **Kalite**: Çok yüksek

### 3. Stability AI
- **Amaç**: Açık kaynak alternatifi
- **Özellikler**: Stable Diffusion modelleri
- **Maliyet**: Token başına $0.01-$0.02
- **Kalite**: Yüksek

### 4. Custom Provider
- **Amaç**: Özel AI servisleri
- **Özellikler**: Tamamen özelleştirilebilir
- **Maliyet**: Servis sağlayıcısına bağlı
- **Kalite**: Servis sağlayıcısına bağlı

## 🔧 Kurulum Adımları

### Adım 1: Ortam Değişkenlerini Ayarlayın

`backend/.env` dosyasını güncelleyin:

```env
# AI Provider Configuration
AI_PROVIDER=mock  # mock, openai, stability, custom
AI_TIMEOUT=30000
AI_RETRIES=3

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_ORGANIZATION=your_openai_organization_id
OPENAI_MODEL=dall-e-3

# Stability AI Configuration
STABILITY_API_KEY=your_stability_api_key_here
STABILITY_MODEL=stable-diffusion-xl-1024-v1-0

# Custom Provider Configuration
CUSTOM_PROVIDER_PATH=./services/aiProviders/customProvider.js
CUSTOM_PROVIDER_CONFIG={"apiKey":"your_custom_api_key"}
```

### Adım 2: AI Provider Seçin

#### Mock Provider (Önerilen - Geliştirme için)
```env
AI_PROVIDER=mock
```

#### OpenAI DALL-E
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=dall-e-3
```

#### Stability AI
```env
AI_PROVIDER=stability
STABILITY_API_KEY=your-stability-api-key
STABILITY_MODEL=stable-diffusion-xl-1024-v1-0
```

#### Custom Provider
```env
AI_PROVIDER=custom
CUSTOM_PROVIDER_PATH=./services/aiProviders/myCustomProvider.js
CUSTOM_PROVIDER_CONFIG={"apiKey":"your-api-key","endpoint":"https://api.example.com"}
```

## 🔑 API Anahtarları Alma

### OpenAI API Anahtarı
1. [OpenAI Platform](https://platform.openai.com)'a gidin
2. Hesap oluşturun veya giriş yapın
3. **API Keys** bölümüne gidin
4. **Create new secret key** butonuna tıklayın
5. Anahtarı kopyalayın ve güvenli bir yerde saklayın

### Stability AI API Anahtarı
1. [Stability AI](https://platform.stability.ai)'ye gidin
2. Hesap oluşturun veya giriş yapın
3. **Account** bölümüne gidin
4. **API Keys** sekmesini seçin
5. **Generate API Key** butonuna tıklayın

## 🧪 Test Etme

### 1. Backend'i Başlatın
```bash
cd backend
npm run dev
```

### 2. Admin Panel'den Test Edin
1. Admin hesabıyla giriş yapın
2. **Admin Panel** > **AI Providers** sayfasına gidin
3. Mevcut provider'ı test edin
4. Farklı provider'lar arasında geçiş yapın

### 3. Görsel Üretimi Test Edin
1. **Images** sayfasına gidin
2. Bir prompt yazın
3. Görsel üretimini test edin

## 📊 Provider Karşılaştırması

| Provider | Kalite | Hız | Maliyet | Kurulum | Önerilen Kullanım |
|----------|--------|-----|---------|---------|-------------------|
| Mock | Düşük | Hızlı | Ücretsiz | Kolay | Geliştirme |
| OpenAI | Çok Yüksek | Orta | Yüksek | Orta | Production |
| Stability | Yüksek | Hızlı | Orta | Orta | Production |
| Custom | Değişken | Değişken | Değişken | Zor | Özel ihtiyaçlar |

## 🔧 Özel Provider Oluşturma

### 1. Provider Sınıfı Oluşturun

`backend/services/aiProviders/customProvider.js`:

```javascript
const BaseAIProvider = require('./baseProvider');

class CustomAIProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'custom';
    this.initialized = false;
  }

  async initialize(config) {
    this.config = { ...this.config, ...config };
    
    // API anahtarını kontrol edin
    if (!this.config.apiKey) {
      throw new Error('Custom API key is required');
    }
    
    this.initialized = true;
    console.log('Custom AI Provider initialized');
    return true;
  }

  async generateImage(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('Custom provider not initialized');
    }

    try {
      // Burada özel AI servisinizi çağırın
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          size: options.size,
          style: options.style
        })
      });

      const data = await response.json();
      
      return {
        success: true,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        prompt,
        options,
        metadata: {
          provider: 'custom',
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new Error(`Custom generation failed: ${error.message}`);
    }
  }

  getAvailableModels() {
    return [
      {
        id: 'custom-model',
        name: 'Custom Model',
        description: 'Your custom AI model',
        maxPromptLength: 1000,
        supportedSizes: ['512x512', '1024x1024']
      }
    ];
  }

  getPricing() {
    return {
      baseCost: 5,
      currency: 'tokens'
    };
  }
}

module.exports = CustomAIProvider;
```

### 2. Provider'ı Kaydedin

`backend/services/aiProviderManager.js` dosyasında provider'ı kaydedin:

```javascript
// Load Custom Provider
if (this.config.customProviderPath) {
  try {
    const CustomProvider = require(this.config.customProviderPath);
    this.registerProvider('custom', CustomProvider);
  } catch (error) {
    console.error('Failed to load custom provider:', error);
  }
}
```

## 🚨 Sorun Giderme

### Yaygın Hatalar

#### 1. "Provider not found" Hatası
- `AI_PROVIDER` değişkeninin doğru ayarlandığından emin olun
- Provider dosyasının mevcut olduğunu kontrol edin

#### 2. "API key is required" Hatası
- API anahtarının `.env` dosyasında doğru ayarlandığından emin olun
- API anahtarının geçerli olduğunu kontrol edin

#### 3. "Rate limit exceeded" Hatası
- API kullanım limitlerini kontrol edin
- Daha yavaş istek gönderin

#### 4. "Content policy violation" Hatası
- Prompt'un uygun içerik kurallarına uyduğundan emin olun
- Uygunsuz içerikleri kaldırın

### Debug Modu

Debug modunu etkinleştirmek için:

```env
NODE_ENV=development
DEBUG=ai-provider:*
```

## 📈 Performans Optimizasyonu

### 1. Timeout Ayarları
```env
AI_TIMEOUT=30000  # 30 saniye
AI_RETRIES=3      # 3 deneme
```

### 2. Caching
Görsel sonuçlarını cache'lemek için Redis kullanabilirsiniz.

### 3. Load Balancing
Birden fazla AI provider kullanarak yük dengelemesi yapabilirsiniz.

## 🔒 Güvenlik

### 1. API Anahtarları
- API anahtarlarını asla kod içinde saklamayın
- `.env` dosyasını `.gitignore`'a ekleyin
- Production'da environment variables kullanın

### 2. Rate Limiting
- API isteklerini sınırlayın
- Kullanıcı başına günlük limit koyun

### 3. Content Filtering
- Prompt'ları filtreleyin
- Uygunsuz içerikleri engelleyin

## 📞 Destek

Sorun yaşarsanız:

1. **Logları kontrol edin**: `backend/logs/` klasörü
2. **Admin panel'den test edin**: Provider durumunu kontrol edin
3. **Dokümantasyonu okuyun**: Bu rehberi tekrar gözden geçirin
4. **Mock provider'a geçin**: Sorun giderme için geçici olarak

---

**Not**: Bu rehber sürekli güncellenmektedir. En güncel bilgiler için proje dokümantasyonunu kontrol edin. 