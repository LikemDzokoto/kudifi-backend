// imports
import * as bcrypt from "bcrypt";
import { Elysia, t } from "elysia";
import swagger from "@elysiajs/swagger";
import { Address, toUnits } from "thirdweb";

// configs
import { prisma, redis } from "@/configs";

// services
import { ThirdwebService, PriceService } from "@/services";

// helpers
import { sanitizePhoneNumber } from "@/helpers";

// constants
import { supportedTokensMap } from "@/constants";

// types
import { TokenSymbol } from "@/generated/prisma";

const MAX_RETRIES = 3;
const TEAM_WALLET_ADDRESS = "0xBf5D88BFDEE112DA8c980781cafB20cE8BFF81CB";

// Valid Ghanaian mobile prefixes
const GHANA_MOBILE_PREFIXES = [
  "020", "023", "024", "025", "026", "027", "028", "029",
  "050", "053", "054", "055", "057", "059",
  "070", "071", "077",
];

const isValidGhanaianPhoneNumber = (phone: string): boolean => {
  const cleanPhone = phone.trim();
  if (cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) {
    return false;
  }
  const prefix = cleanPhone.slice(0, 3);
  return GHANA_MOBILE_PREFIXES.includes(prefix);
};

const formatPhoneNumber = (phone: string): string => {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
};

const getTokenName = (option: string): string => {
  const tokens = { "1": "APE", "2": "USDT", "3": "USDC" };
  return tokens[option as keyof typeof tokens] || "Unknown";
};

const getTokenSymbol = (option: string): TokenSymbol => {
  const tokens = { "1": TokenSymbol.APE, "2": TokenSymbol.USDT, "3": TokenSymbol.USDC };
  return tokens[option as keyof typeof tokens];
};

const buildMainMenu = (): string => {
  return `CON Welcome to Kudifi
1. Send tokens
2. Check balance
3. Buy tokens
4. View Rewards
5. View Wallet Address
6. Withdraw to Momo
7. Donate to Team`;
};

const buildTokenMenu = (): string => {
  return `CON Choose token:
1. APE
2. USDT
3. USDC`;
};

const handleError = (message: string): string => {
  return `END ❌ ${message}`;
};

const validateAmount = (amountStr: string): { isValid: boolean; amount?: number; error?: string } => {
  const amount = Number(amountStr);
  if (isNaN(amount)) {
    return { isValid: false, error: "Please enter a valid number" };
  }
  if (amount <= 0) {
    return { isValid: false, error: "Amount must be greater than 0" };
  }
  if (amount > 1000000) {
    return { isValid: false, error: "Amount too large" };
  }
  return { isValid: true, amount };
};

const app = new Elysia().use(
  swagger({
    autoDarkMode: true,
    documentation: {
      info: {
        title: "Kudifi API",
        version: "1.0.0",
        description: "API documentation for Kudifi backend.",
      },
    },
  })
);

app.get("/", () => "Hello, World!");

app.post(
  "/",
  async ({ body }) => {
    const { phoneNumber, text } = body;
    const input = text.trim();
    const cleanPhone = sanitizePhoneNumber(phoneNumber);
    
    let response = "";
    try {
      let user = await prisma.user.findUnique({
        where: { phoneNumber: cleanPhone },
      });

      // New user flow
      if (!user) {
        switch (true) {
          case input === "":
            response = `CON Welcome to Kudifi! 🚀
You need to create a wallet to get started.
1. Create wallet`;
            break;

          case input === "1": {
            try {
              const wallet = await ThirdwebService.createWallet();
              console.log("string",wallet)

              user = await prisma.user.create({
                data: {
                  phoneNumber: cleanPhone,
                  walletAddr: wallet.address,
                  smartWalletAddr: wallet.smartAccountAddress,
                },
              });
             
              response = `CON ✅ Wallet created successfully!
Your wallet: ${(user.smartWalletAddr || user.walletAddr).slice(0, 10)}...

Now set a 4-digit PIN for security:`;
            } catch (error) {
              response = handleError("Failed to create wallet. Please try again.");
            }
            break;
          }

          default:
            response = handleError("Invalid option. Please try again.");
        }
        return response;
      }

      // PIN setup flow
      if (!user.pinHash) {
        if (input === "1") {
          response = `CON Set a 4-digit PIN to secure your wallet:`;
        } else if (/^\d{4}$/.test(input)) {
          try {
            const hash = await bcrypt.hash(input, 10);
            await prisma.user.update({
              where: { phoneNumber: cleanPhone },
              data: { pinHash: hash },
            });
            response = `END ✅ PIN set successfully! You can now use Kudifi securely.`;
          } catch (error) {
            response = handleError("Failed to set PIN. Please try again.");
          }
        } else if (input.length > 0) {
          response = `CON ❌ PIN must be exactly 4 digits.
Please enter a 4-digit PIN:`;
        } else {
          response = `CON Set a 4-digit PIN to proceed:`;
        }
        return response;
      }

      // Main application flow  
      switch (true) {
        case input === "":
          response = buildMainMenu();
          break;

//         // Check Balance Flow
//         case input === "2":
//           response = buildTokenMenu();
//           break;

//         case ["2*1", "2*2", "2*3"].includes(input): {
//           const tokenOpt = input.split("*")[1];
//           const token = getTokenName(tokenOpt);
//           try {
//             const balance = await ThirdwebService.getTokenBalance(
//               (user.smartWalletAddr || user.walletAddr) as Address,
//               token as TokenSymbol
//             );
//             const rate = await PriceService.getTokenPriceInGHS(token);
//             const value = (Number(balance) * rate).toFixed(2);
//             response = `END 💰 Your ${token} Balance
// Amount: ${balance} ${token}
// Value: ~GHS ${value}

// Rate: 1 ${token} = GHS ${rate}`;
//           } catch (error) {
//             response = handleError(`Failed to fetch ${token} balance. Please try again.`);
//             console.log('string', error)
//           }
//           break;
//         }
// Check Balance Flow with Logging
case input === "2":
  console.log("📟 User selected: View Token Menu");
  response = buildTokenMenu();
  break;

case ["2*1", "2*2", "2*3"].includes(input): {
  const tokenOpt = input.split("*")[1];
  const token = getTokenName(tokenOpt);
  const walletAddr = (user.smartWalletAddr || user.walletAddr) as Address;

  console.log(`📥 Balance check triggered for token: ${token}`);
  console.log(`👤 Wallet Address: ${walletAddr}`);

  try {
    console.log("🔄 Fetching token balance...");
    const balance = await ThirdwebService.getTokenBalance(walletAddr, token as TokenSymbol);
    console.log(`✅ Token Balance fetched: ${balance} ${token}`);

    console.log("🔄 Fetching token price in GHS...");
    const rate = await PriceService.getTokenPriceInGHS(token);
    console.log(`✅ Token rate in GHS: 1 ${token} = GHS ${rate}`);

    const value = (Number(balance) * rate).toFixed(2);
    console.log(`📊 Total Value: ~GHS ${value}`);

    response = `END 💰 Your ${token} Balance
Amount: ${balance} ${token}
Value: ~GHS ${value}

Rate: 1 ${token} = GHS ${rate}`;
  } catch (error) {
    console.error(`❌ Error fetching ${token} balance for ${walletAddr}:`, error);
    response = handleError(`Failed to fetch ${token} balance. Please try again.`);
  }

  break;
}
//         // Send Tokens Flow
//         case input === "1":
//           response = buildTokenMenu();
//           break;

//         case /^1\*[1-3]$/.test(input): {
//           const tokenOpt = input.split("*")[1];
//           const token = getTokenName(tokenOpt);
//           response = `CON 💸 Send ${token} Tokens
// Enter recipient phone number:
// (Format: 054xxxxxxxx)`;
//           break;
//         }

//         case /^1\*[1-3]\*\d{10}$/.test(input): {
//           const [_, tokenOpt, rawRecipientPhone] = input.split("*");
//           const token = getTokenName(tokenOpt);

//           if (!isValidGhanaianPhoneNumber(rawRecipientPhone)) {
//             response = `END ❌ Invalid phone number format
// Please use: 054xxxxxxxx

// Valid prefixes: ${GHANA_MOBILE_PREFIXES.slice(0, 8).join(", ")}...`;
//             break;
//           }

//           const formattedPhone = formatPhoneNumber(rawRecipientPhone);
//           response = `CON 📱 Confirm Recipient
// Phone: ${formattedPhone}
// Token: ${token}

// 1. Confirm & continue
// 2. Re-enter phone number`;
//           break;
//         }

//         case /^1\*[1-3]\*\d{10}\*2$/.test(input): {
//           const [_, tokenOpt] = input.split("*");
//           const token = getTokenName(tokenOpt);
//           response = `CON 💸 Send ${token} Tokens
// Enter recipient phone number:
// (Format: 054xxxxxxxx)`;
//           break;
//         }

//         case /^1\*[1-3]\*\d{10}\*1$/.test(input): {
//           const [_, tokenOpt, rawRecipientPhone] = input.split("*");
//           const token = getTokenName(tokenOpt);
          
//           try {
//             const balance = await ThirdwebService.getTokenBalance(
//               (user.smartWalletAddr || user.walletAddr) as Address,
//               token as TokenSymbol
//             );
//             response = `CON 💰 Send ${token}
// To: ${formatPhoneNumber(rawRecipientPhone)}
// Available: ${balance} ${token}

// Enter amount to send:`;
//           } catch (error) {
//             response = handleError("Failed to check balance. Please try again.");
//             console.log("string", error)
//           }
//           break;
//         }

//         case /^1\*[1-3]\*\d{10}\*1\*[\d.]+$/.test(input): {
//           const [_, tokenOpt, rawRecipientPhone, , amountStr] = input.split("*");
//           const token = getTokenName(tokenOpt);
//           const validation = validateAmount(amountStr);

//           if (!validation.isValid) {
//             response = `CON ❌ ${validation.error}
// Please enter a valid amount:`;
//             break;
//           }

//           try {
//             const balance = await ThirdwebService.getTokenBalance(
//               (user.smartWalletAddr || user.walletAddr) as Address,
//               token as TokenSymbol
//             );
            
//             if (Number(balance) < validation.amount!) {
//               response = `CON ❌ Insufficient Balance
// Available: ${balance} ${token}
// Requested: ${validation.amount} ${token}

// 1. Enter different amount`;
//               break;
//             }

//             const rate = await PriceService.getTokenPriceInGHS(token);
//             const value = (validation.amount! * rate).toFixed(2);

//             response = `CON 🔒 Confirm Transaction
// To: ${formatPhoneNumber(rawRecipientPhone)}
// Amount: ${validation.amount} ${token}
// Value: ~GHS ${value}

// Enter your 4-digit PIN:`;
//           } catch (error) {
//             response = handleError("Failed to verify transaction. Please try again.");
//           }
//           break;
//         }

//         case /^1\*[1-3]\*\d{10}\*1\*[\d.]+\*1$/.test(input): {
//           const [_, tokenOpt, rawRecipientPhone, ,] = input.split("*");
//           const token = getTokenName(tokenOpt);
          
//           try {
//             const balance = await ThirdwebService.getTokenBalance(
//               (user.smartWalletAddr || user.walletAddr) as Address,
//               token as TokenSymbol
//             );
//             response = `CON 💰 Send ${token}
// To: ${formatPhoneNumber(rawRecipientPhone)}
// Available: ${balance} ${token}

// Enter amount to send:`;
//           } catch (error) {
//             response = handleError("Failed to check balance. Please try again.");
//           }
//           break;
//         }

//         case /^1\*[1-3]\*\d{10}\*1\*[\d.]+\*\d{4}$/.test(input): {
//           const [_, tokenOpt, rawRecipientPhone, , amountStr, pin] = input.split("*");
//           const token = getTokenName(tokenOpt);
//           const selectedToken = supportedTokensMap[token as TokenSymbol];
//           const validation = validateAmount(amountStr);
//           const recipientPhone = sanitizePhoneNumber(rawRecipientPhone);

//           if (!validation.isValid) {
//             response = handleError(validation.error!);
//             break;
//           }

//           const retryKey = `pin-retry:${cleanPhone}`;
//           const retryCount = parseInt((await redis.get(retryKey)) || "0");

//           if (retryCount >= MAX_RETRIES) {
//             response = handleError("Too many incorrect PIN attempts. Try again later.");
//             break;
//           }

//           try {
//             // Verify balance again
//             const balance = await ThirdwebService.getTokenBalance(
//               (user.smartWalletAddr || user.walletAddr) as Address,
//               token as TokenSymbol
//             );
            
//             if (Number(balance) < validation.amount!) {
//               response = handleError(`Insufficient ${token} balance for transaction.`);
//               break;
//             }

//             // Verify PIN
//             const validPin = await bcrypt.compare(pin, user.pinHash!);
//             if (!validPin) {
//               await redis.setex(retryKey, 3600, (retryCount + 1).toString());
//               response = handleError(`Incorrect PIN. Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
//               break;
//             }

//             await redis.del(retryKey);

//             // Find or create recipient
//             let recipient = await prisma.user.findUnique({
//               where: { phoneNumber: recipientPhone },
//             });

//             if (!recipient) {
//               const wallet = await ThirdwebService.createWallet();
//               recipient = await prisma.user.create({
//                 data: {
//                   phoneNumber: recipientPhone,
//                   walletAddr: wallet.address,
//                   smartWalletAddr: wallet.smartAccountAddress,
//                 },
//               });
//             }

//             // Execute transaction
//             await ThirdwebService.sendToken({
//               from: (user.smartWalletAddr || user.walletAddr) as Address,
//               to: (recipient.smartWalletAddr || recipient.walletAddr) as Address,
//               tokenSymbol: selectedToken.symbol,
//               amount: toUnits(validation.amount!.toString(), selectedToken.decimals),
//             });

//             response = `END ✅ Transaction Successful!
// Sent: ${validation.amount} ${token}
// To: ${formatPhoneNumber(rawRecipientPhone)}

// Transaction completed successfully.`;
//           } catch (error) {
//             console.error("Send token error:", error);
//             response = handleError("Transaction failed. Please try again.");
//           }
//           break;
//         }
// Send Tokens Flow with Verbose Logging
case input === "1":
  console.log("🟢 User selected 'Send Tokens'");
  response = buildTokenMenu();
  break;

case /^1\*[1-3]$/.test(input): {
  const tokenOpt = input.split("*")[1];
  const token = getTokenName(tokenOpt);
  console.log(`🔢 Token selected: Option ${tokenOpt} → Token ${token}`);

  response = `CON 💸 Send ${token} Tokens
Enter recipient phone number:
(Format: 054xxxxxxxx)`;
  break;
}

case /^1\*[1-3]\*\d{10}$/.test(input): {
  const [_, tokenOpt, rawRecipientPhone] = input.split("*");
  const token = getTokenName(tokenOpt);
  console.log(`📨 Phone number entry flow triggered for Token ${token}`);
  console.log(`📱 Raw input phone: ${rawRecipientPhone}`);

  if (!isValidGhanaianPhoneNumber(rawRecipientPhone)) {
    console.warn("⚠️ Invalid phone format:", rawRecipientPhone);
    response = `END ❌ Invalid phone number format
Please use: 054xxxxxxxx

Valid prefixes: ${GHANA_MOBILE_PREFIXES.slice(0, 8).join(", ")}...`;
    break;
  }

  const formattedPhone = formatPhoneNumber(rawRecipientPhone);
  console.log("✅ Valid phone, formatted:", formattedPhone);

  response = `CON 📱 Confirm Recipient
Phone: ${formattedPhone}
Token: ${token}

1. Confirm & continue
2. Re-enter phone number`;
  break;
}

case /^1\*[1-3]\*\d{10}\*2$/.test(input): {
  const [_, tokenOpt] = input.split("*");
  const token = getTokenName(tokenOpt);
  console.log("🔄 Re-enter phone number for token:", token);

  response = `CON 💸 Send ${token} Tokens
Enter recipient phone number:
(Format: 054xxxxxxxx)`;
  break;
}

case /^1\*[1-3]\*\d{10}\*1$/.test(input): {
  const [_, tokenOpt, rawRecipientPhone] = input.split("*");
  const token = getTokenName(tokenOpt);
  console.log(`🧮 Fetching balance for Token ${token} before sending`);
  console.log(`📱 Recipient: ${rawRecipientPhone}`);

  try {
    const balance = await ThirdwebService.getTokenBalance(
      (user.smartWalletAddr || user.walletAddr) as Address,
      token as TokenSymbol
    );
    console.log(`✅ Balance fetched: ${balance} ${token}`);

    response = `CON 💰 Send ${token}
To: ${formatPhoneNumber(rawRecipientPhone)}
Available: ${balance} ${token}

Enter amount to send:`;
  } catch (error) {
    console.error("❌ Error fetching balance:", error);
    response = handleError("Failed to check balance. Please try again.");
  }

  break;
}

case /^1\*[1-3]\*\d{10}\*1\*[\d.]+$/.test(input): {
  const [_, tokenOpt, rawRecipientPhone, , amountStr] = input.split("*");
  const token = getTokenName(tokenOpt);
  console.log(`💸 Sending ${token}, entered amount: ${amountStr}`);

  const validation = validateAmount(amountStr);
  if (!validation.isValid) {
    console.warn("❗ Invalid amount:", validation.error);
    response = `CON ❌ ${validation.error}
Please enter a valid amount:`;
    break;
  }

  try {
    const balance = await ThirdwebService.getTokenBalance(
      (user.smartWalletAddr || user.walletAddr) as Address,
      token as TokenSymbol
    );
    console.log("📊 Current balance:", balance);

    if (Number(balance) < validation.amount!) {
      console.warn(`⚠️ Insufficient funds (${balance}) for amount ${validation.amount}`);
      response = `CON ❌ Insufficient Balance
Available: ${balance} ${token}
Requested: ${validation.amount} ${token}

1. Enter different amount`;
      break;
    }

    const rate = await PriceService.getTokenPriceInGHS(token);
    const value = (validation.amount! * rate).toFixed(2);
    console.log(`💱 GHS Rate for ${token}: ${rate}, Value: GHS ${value}`);

    response = `CON 🔒 Confirm Transaction
To: ${formatPhoneNumber(rawRecipientPhone)}
Amount: ${validation.amount} ${token}
Value: ~GHS ${value}

Enter your 4-digit PIN:`;
  } catch (error) {
    console.error("❌ Error during transaction validation:", error);
    response = handleError("Failed to verify transaction. Please try again.");
  }
  break;
}

case /^1\*[1-3]\*\d{10}\*1\*[\d.]+\*1$/.test(input): {
  const [_, tokenOpt, rawRecipientPhone] = input.split("*");
  const token = getTokenName(tokenOpt);
  console.log(`🔁 User wants to re-enter amount for Token ${token}`);
  console.log(`📱 Recipient: ${rawRecipientPhone}`);

  try {
    const balance = await ThirdwebService.getTokenBalance(
      (user.smartWalletAddr || user.walletAddr) as Address,
      token as TokenSymbol
    );
    console.log(`✅ Balance fetched: ${balance} ${token}`);

    response = `CON 💰 Send ${token}
To: ${formatPhoneNumber(rawRecipientPhone)}
Available: ${balance} ${token}

Enter amount to send:`;
  } catch (error) {
    console.error("❌ Error fetching balance for amount retry:", error);
    response = handleError("Failed to check balance. Please try again.");
  }
  break;
}

case /^1\*[1-3]\*\d{10}\*1\*[\d.]+\*\d{4}$/.test(input): {
  const [_, tokenOpt, rawRecipientPhone, , amountStr, pin] = input.split("*");
  const token = getTokenName(tokenOpt);
  const selectedToken = supportedTokensMap[token as TokenSymbol];
  const validation = validateAmount(amountStr);
  const recipientPhone = sanitizePhoneNumber(rawRecipientPhone);
  console.log("🔐 PIN transaction flow initiated");

  if (!validation.isValid) {
    console.warn("❗ Invalid amount during PIN flow:", validation.error);
    response = handleError(validation.error!);
    break;
  }

  const retryKey = `pin-retry:${cleanPhone}`;
  const retryCount = parseInt((await redis.get(retryKey)) || "0");
  console.log(`🔁 PIN retry count: ${retryCount}`);

  if (retryCount >= MAX_RETRIES) {
    console.warn("🚫 Max PIN retries reached");
    response = handleError("Too many incorrect PIN attempts. Try again later.");
    break;
  }

  try {
    const balance = await ThirdwebService.getTokenBalance(
      (user.smartWalletAddr || user.walletAddr) as Address,
      token as TokenSymbol
    );
    console.log("📊 Balance at transaction:", balance);

    if (Number(balance) < validation.amount!) {
      console.warn("💥 Insufficient balance for transaction");
      response = handleError(`Insufficient ${token} balance for transaction.`);
      break;
    }

    const validPin = await bcrypt.compare(pin, user.pinHash!);
    if (!validPin) {
      await redis.setex(retryKey, 3600, (retryCount + 1).toString());
      console.warn("🔐 Incorrect PIN attempt", retryCount + 1);
      response = handleError(`Incorrect PIN. Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
      break;
    }

    await redis.del(retryKey);
    console.log("🔓 PIN verified, proceeding with transaction");

    let recipient = await prisma.user.findUnique({
      where: { phoneNumber: recipientPhone },
    });

    if (!recipient) {
      console.log("➕ Creating new wallet for recipient");
      const wallet = await ThirdwebService.createWallet();
      recipient = await prisma.user.create({
        data: {
          phoneNumber: recipientPhone,
          walletAddr: wallet.address,
          smartWalletAddr: wallet.smartAccountAddress,
        },
      });
    } else {
      console.log("👤 Found existing recipient:", recipient.phoneNumber);
    }

    await ThirdwebService.sendToken({
      from: (user.smartWalletAddr || user.walletAddr) as Address,
      to: (recipient.smartWalletAddr || recipient.walletAddr) as Address,
      tokenSymbol: selectedToken.symbol,
      amount: toUnits(validation.amount!.toString(), selectedToken.decimals),
    });

    console.log("✅ Transaction completed successfully");
    response = `END ✅ Transaction Successful!
Sent: ${validation.amount} ${token}
To: ${formatPhoneNumber(rawRecipientPhone)}

Transaction completed successfully.`;
  } catch (error) {
    console.error("❌ Transaction failed:", error);
    response = handleError("Transaction failed. Please try again.");
  }

  break;
}

        // Buy Tokens Flow
        case input === "3":
          response = buildTokenMenu();
          break;

        case ["3*1", "3*2", "3*3"].includes(input): {
          const tokenOpt = input.split("*")[1];
          const token = getTokenName(tokenOpt);
          try {
            const rate = await PriceService.getTokenPriceInGHS(token);
            response = `CON 💳 Buy ${token} Tokens
Rate: 1 ${token} = GHS ${rate}

Enter amount in GHS:`;
          } catch (error) {
            response = handleError("Failed to get current rates. Please try again.");
          }
          break;
        }

        case /^3\*[1-3]\*[\d.]+$/.test(input): {
          const [_, tokenOpt, amountStr] = input.split("*");
          const token = getTokenName(tokenOpt);
          const validation = validateAmount(amountStr);

          if (!validation.isValid) {
            response = `CON ❌ ${validation.error}
Please enter amount in GHS:`;
            break;
          }

          try {
            const rate = await PriceService.getTokenPriceInGHS(token);
            const tokensToReceive = (validation.amount! / rate).toFixed(6);
            
            response = `CON 💳 Confirm Purchase
Amount: GHS ${validation.amount}
Rate: 1 ${token} = GHS ${rate}
You'll receive: ${tokensToReceive} ${token}

1. Confirm purchase
2. Enter different amount`;
          } catch (error) {
            response = handleError("Failed to calculate purchase. Please try again.");
          }
          break;
        }

        case /^3\*[1-3]\*[\d.]+\*2$/.test(input): {
          const [_, tokenOpt] = input.split("*");
          const token = getTokenName(tokenOpt);
          try {
            const rate = await PriceService.getTokenPriceInGHS(token);
            response = `CON 💳 Buy ${token} Tokens
Rate: 1 ${token} = GHS ${rate}

Enter amount in GHS:`;
          } catch (error) {
            response = handleError("Failed to get current rates. Please try again.");
          }
          break;
        }

        case /^3\*[1-3]\*[\d.]+\*1$/.test(input): {
          const [_, tokenOpt, amountStr] = input.split("*");
          const token = getTokenSymbol(tokenOpt);
          const validation = validateAmount(amountStr);

          if (!validation.isValid) {
            response = handleError(validation.error!);
            break;
          }

          try {
            await prisma.purchase.create({
              data: {
                userId: user.id,
                provider: "MTN",
                phoneNumber,
                tokenSymbol: token,
                amount: validation.amount!,
                status: "PENDING",
              },
            });

            response = `END ✅ Purchase Initiated
Amount: GHS ${validation.amount}
Token: ${getTokenName(tokenOpt)}
Status: Processing

You'll receive your tokens shortly.`;
          } catch (error) {
            response = handleError("Failed to process purchase. Please try again.");
          }
          break;
        }

        // View Rewards
        case input === "4":
          response = `END 🎁 Rewards System
Coming soon! 

Stay tuned for exciting rewards and cashback opportunities.`;
          break;

        // View Wallet Address
        case input === "5":
          const walletAddress = user.smartWalletAddr || user.walletAddr;
          response = `END 👛 Your Wallet Address
${walletAddress}

You can share this address to receive tokens from external wallets.`;
          break;

        // Withdraw to Momo
        case input === "6":
          response = `END 📱 Mobile Money Withdrawal
Coming soon!

This feature will allow you to withdraw your tokens directly to your mobile money account.`;
          break;

        // Donate to Team Flow
        case input === "7":
          response = `CON ❤️ Support Our Team
Choose token to donate:
1. APE
2. USDT
3. USDC`;
          break;

        case ["7*1", "7*2", "7*3"].includes(input): {
          const tokenOpt = input.split("*")[1];
          const token = getTokenName(tokenOpt);
          try {
            const balance = await ThirdwebService.getTokenBalance(
              (user.smartWalletAddr || user.walletAddr) as Address,
              token as TokenSymbol
            );
            response = `CON ❤️ Donate ${token}
Available: ${balance} ${token}

Enter amount to donate:`;
          } catch (error) {
            response = handleError("Failed to check balance. Please try again.");
          }
          break;
        }

        case /^7\*[1-3]\*[\d.]+$/.test(input): {
          const [_, tokenOpt, amountStr] = input.split("*");
          const token = getTokenName(tokenOpt);
          const validation = validateAmount(amountStr);

          if (!validation.isValid) {
            response = `CON ❌ ${validation.error}
Please enter amount to donate:`;
            break;
          }

          try {
            const balance = await ThirdwebService.getTokenBalance(
              (user.smartWalletAddr || user.walletAddr) as Address,
              token as TokenSymbol
            );
            
            if (Number(balance) < validation.amount!) {
              response = `CON ❌ Insufficient Balance
Available: ${balance} ${token}
Requested: ${validation.amount} ${token}

1. Enter different amount`;
              break;
            }

            const rate = await PriceService.getTokenPriceInGHS(token);
            const value = (validation.amount! * rate).toFixed(2);

            response = `CON ❤️ Confirm Donation
Amount: ${validation.amount} ${token}
Value: ~GHS ${value}
To: Kudifi Team

Enter your 4-digit PIN:`;
          } catch (error) {
            response = handleError("Failed to verify donation. Please try again.");
          }
          break;
        }

        case /^7\*[1-3]\*[\d.]+\*1$/.test(input): {
          const [_, tokenOpt] = input.split("*");
          const token = getTokenName(tokenOpt);
          try {
            const balance = await ThirdwebService.getTokenBalance(
              (user.smartWalletAddr || user.walletAddr) as Address,
              token as TokenSymbol
            );
            response = `CON ❤️ Donate ${token}
Available: ${balance} ${token}

Enter amount to donate:`;
          } catch (error) {
            response = handleError("Failed to check balance. Please try again.");
          }
          break;
        }

        case /^7\*[1-3]\*[\d.]+\*\d{4}$/.test(input): {
          const [_, tokenOpt, amountStr, pin] = input.split("*");
          const token = getTokenName(tokenOpt);
          const selectedToken = supportedTokensMap[token as TokenSymbol];
          const validation = validateAmount(amountStr);

          if (!validation.isValid) {
            response = handleError(validation.error!);
            break;
          }

          const retryKey = `pin-retry:${cleanPhone}`;
          const retryCount = parseInt((await redis.get(retryKey)) || "0");

          if (retryCount >= MAX_RETRIES) {
            response = handleError("Too many incorrect PIN attempts. Try again later.");
            break;
          }

          try {
            // Verify balance
            const balance = await ThirdwebService.getTokenBalance(
              (user.smartWalletAddr || user.walletAddr) as Address,
              token as TokenSymbol
            );
            
            if (Number(balance) < validation.amount!) {
              response = handleError(`Insufficient ${token} balance for donation.`);
              break;
            }

            // Verify PIN
            const validPin = await bcrypt.compare(pin, user.pinHash!);
            if (!validPin) {
              await redis.setex(retryKey, 3600, (retryCount + 1).toString());
              response = handleError(`Incorrect PIN. Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
              break;
            }

            await redis.del(retryKey);

            // Execute donation
            await ThirdwebService.sendToken({
              from: (user.smartWalletAddr || user.walletAddr) as Address,
              to: TEAM_WALLET_ADDRESS as Address,
              tokenSymbol: selectedToken.symbol,
              amount: toUnits(validation.amount!.toString(), selectedToken.decimals),
            });

            response = `END ❤️ Thank You!
Donated: ${validation.amount} ${token}
To: Kudifi Team

Your support helps us improve Kudifi for everyone!`;
          } catch (error) {
            console.error("Donation error:", error);
            response = handleError("Donation failed. Please try again.");
          }
          break;
        }

        default:
          response = handleError("Invalid option. Please try again.");
      }

    } catch (error) {
      console.error("Error processing request:", error);
      response = handleError("An unexpected error occurred. Please try again.");
    }

    return response;
  },
  {
    body: t.Object({
      sessionId: t.String(),
      serviceCode: t.String(),
      phoneNumber: t.String(),
      text: t.String(),
    }),
  }
);

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export default app.handle;