# Kudifi Backend

A comprehensive backend service for Kudifi - Ghana's first USSD-based crypto wallet platform. Built with Elysia and Bun, it provides seamless blockchain wallet management, token transfers, and mobile money integration through simple USSD flows accessible on any mobile phone.

**🌐 Production URL**: https://kudifi-backend.fly.dev/

## 🌟 Key Features

- **🏦 Smart Wallet Management**: Auto-created wallets with account abstraction via Thirdweb
- **⛽ Gas-Free Transactions**: Sponsored gas fees for seamless user experience  
- **📱 USSD Interface**: Complete crypto wallet functionality via USSD codes
- **🔐 PIN Security**: 4-digit PIN protection with retry limits
- **🐒 APE Chain Exclusive**: Built exclusively on APE Chain for optimal performance
- **💸 Token Support**: APE, USDT, USDC with real-time pricing
- **🇬🇭 Ghana-Focused**: Ghanaian phone number validation and GHS pricing
- **💳 Mobile Money Integration**: Built-in support for withdrawal to MoMo (coming soon)

## 📱 USSD Flow Overview

Users interact with Kudifi through intuitive USSD menus:

### **New User Journey**
```
*XXX# → Welcome to Kudifi! 🚀
       → 1. Create wallet
       → ✅ Wallet created
       → Set 4-digit PIN
       → ✅ Ready to use!
```

### **Main Menu**
```
Welcome to Kudifi
1. Send tokens     → Choose token → Enter phone → Confirm → Amount → PIN → ✅ Sent
2. Check balance   → Choose token → 💰 Balance shown with GHS value
3. Buy tokens      → Choose token → Enter GHS amount → ✅ Purchase initiated
4. View Rewards    → 🎁 Coming soon!
5. View Wallet     → 👛 Smart wallet address displayed
6. Withdraw MoMo   → 📱 Coming soon!
7. Donate to Team  → Choose token → Amount → PIN → ❤️ Thank you!
```

### **Send Tokens Flow**
```
Send APE Tokens
└─ Enter phone (054xxxxxxxx)
   └─ Confirm recipient
      └─ Enter amount
         └─ Confirm transaction  
            └─ Enter PIN
               └─ ✅ Transaction successful!
```

## 🏗️ Backend Architecture

### **Framework & Runtime**
- **[Elysia](https://elysiajs.com/)**: Modern web framework for Bun
- **[Bun](https://bun.sh/)**: Fast JavaScript runtime and package manager
- **TypeScript**: Full type safety throughout the codebase

### **Blockchain Integration**
- **[Thirdweb](https://thirdweb.com/)**: Smart wallet creation with account abstraction
- **APE Chain Exclusive**: Built exclusively on APE Chain for optimal performance and ecosystem benefits
- **Account Abstraction**: Users get smart wallets without gas complexity
- **Gas Sponsorship**: All transactions sponsored for seamless UX
- **Multi-token Support**: APE, USDT, USDC on APE Chain

### **Database & Caching**
- **PostgreSQL**: Primary database with Prisma ORM
- **Prisma Accelerate**: Enhanced performance and connection pooling
- **Upstash Redis**: Caching for prices and session management

### **External Services**
- **Pyth Network**: Real-time cryptocurrency price feeds
- **Currency API**: Fiat exchange rates for GHS conversion
- **Africa's Talking**: USSD gateway integration (planned)

## 📡 API Architecture

### **USSD Endpoint**
The core endpoint processes all USSD interactions:

```typescript
POST /
Content-Type: application/json

{
  "sessionId": "ATUid_session_id",
  "serviceCode": "*123#", 
  "phoneNumber": "+233541234567",
  "text": "1*2*0541234567*1*100"
}
```

**Response Format:**
- `CON`: Continue session with menu
- `END`: End session with final message

### **Flow Processing**
The backend intelligently routes requests based on input patterns:

```typescript
// Examples of routing logic
"1" → Send tokens menu
"1*2" → Send USDT 
"1*2*0541234567" → Confirm recipient for USDT
"1*2*0541234567*1*100*1234" → Execute transfer with PIN
```

## 🔐 Security Features

### **PIN Protection**
- 4-digit PIN required for all transactions
- bcrypt hashing for secure storage
- Retry limits with Redis-based lockout
- PIN validation on every sensitive operation

### **Phone Number Validation**
```typescript
// Valid Ghanaian prefixes
const GHANA_MOBILE_PREFIXES = [
  "020", "023", "024", "025", "026", "027", "028", "029",
  "050", "053", "054", "055", "057", "059", 
  "070", "071", "077"
];
```

### **Amount Validation**
- Range checks (0 < amount ≤ 1,000,000)
- Balance verification before transactions
- Decimal precision handling

## 🛠️ Services Architecture

### **ThirdwebService**
```typescript
// Core blockchain operations
- createWallet()           // Auto-create smart wallets
- getTokenBalance()        // Check token balances  
- sendToken()             // Execute transfers with gas sponsorship
```

### **PriceService**  
```typescript
// Real-time pricing
- getTokenPriceInGHS()    // Live crypto → GHS rates
- getCachedRate()         // Redis-cached exchange rates
```

### **User Management**
```typescript
// Database operations via Prisma
- User creation with wallet linking
- PIN hash storage and verification
- Transaction history tracking
- Purchase record management
```

## 🌍 Ghana-Specific Features

### **Localized Experience**
- **Phone Format**: 054 XXX XXXX validation and formatting
- **Currency**: Real-time GHS pricing for all tokens
- **Mobile Money**: Built-in MoMo withdrawal support (coming soon)
- **Language**: English with Ghana-friendly terminology

### **Supported Networks**
- **APE Chain Exclusive**: Kudifi operates exclusively on APE Chain
- **Optimized Performance**: Built specifically for APE Chain's ecosystem
- **Gas Sponsorship**: All transaction fees covered by Kudifi
- **Smart Wallet Benefits**: Account abstraction removes technical complexity

## 🚀 Getting Started

### **Prerequisites**
- [Bun](https://bun.sh/) runtime
- PostgreSQL database
- Redis instance
- Thirdweb API keys

### **Installation**

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd kudifi-backend
bun install
```

2. **Environment setup:**
```bash
cp .env.example .env
# Fill in your environment variables
```

3. **Database setup:**
```bash
bunx prisma generate
bunx prisma db push
```

4. **Start development server:**
```bash
bun run dev
```

The service will be available at:
- **Production API**: https://kudifi-backend.fly.dev/
- **Production Docs**: https://kudifi-backend.fly.dev/swagger
- **Local API**: http://localhost:3000
- **Local Documentation**: http://localhost:3000/swagger

## 📊 Environment Variables

### **Required Configuration**
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/database_name?schema=public"

# Thirdweb (APE Chain Integration)
THIRDWEB_CLIENT_ID="your_client_id_here"
THIRDWEB_SECRET_KEY="your_secret_key_here"
THIRDWEB_VAULT_ADMIN_KEY="your_vault_admin_key_here"
THIRDWEB_VAULT_ACCESS_TOKEN="your_vault_access_token_here"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_redis_token_here"
```

### **Getting Your Keys**

**Thirdweb Setup:**
1. Visit [Thirdweb Dashboard](https://thirdweb.com/dashboard)
2. Create a new project or select existing
3. Navigate to Settings → API Keys
4. Generate your Client ID and Secret Key
5. For Vault keys, go to Vault section in dashboard

**Upstash Redis:**
1. Sign up at [Upstash](https://upstash.com/)
2. Create a new Redis database
3. Copy the REST URL and Token from database details

**Database:**
- Use PostgreSQL 14+ for optimal performance
- Ensure connection string includes schema parameter

## 🔄 USSD Integration

### **Africa's Talking Integration**
The backend is designed for seamless integration with Africa's Talking USSD gateway:

```javascript
// Expected webhook payload
{
  "sessionId": "unique_session_id",
  "serviceCode": "*your_code#",
  "phoneNumber": "+233XXXXXXXXX", 
  "text": "user_input_chain"
}
```

### **Response Handling**
- **CON responses**: Continue the USSD session
- **END responses**: Terminate with final message
- **Error handling**: Graceful fallbacks for all edge cases

## 📈 Future Enhancements

- **Mobile Money Withdrawals**: Direct USDT/USDC → MoMo conversion
- **Rewards System**: Cashback and loyalty programs
- **Multi-language Support**: Twi, Ga, Hausa support
- **Advanced Trading**: Limit orders and DCA features
- **Merchant Integration**: Business payment solutions

**Kudifi** - Making cryptocurrency accessible to everyone in Ghana through simple USSD technology. 🇬🇭🚀