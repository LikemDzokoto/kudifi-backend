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
  "070", "071", "077"
];

const isValidGhanaianPhoneNumber = (phone: string): boolean => {
  const cleanPhone = phone.trim();
  if (cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) {
    return false;
  }
  const prefix = cleanPhone.slice(0, 3);
  return GHANA_MOBILE_PREFIXES.includes(prefix);
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
    const user = await prisma.user.findUnique({
      where: { phoneNumber: cleanPhone },
    });

    let response = "";

    try {
      if (!user) {
        switch (input) {
          case "":
            response = `CON Welcome to Kudifi\n1. Create wallet`;
            break;

          case "1": {
            const wallet = await ThirdwebService.createWallet();
            await prisma.user.create({
              data: {
                phoneNumber: cleanPhone,
                walletAddr: wallet.address,
                smartWalletAddr: wallet.smartAccountAddress,
              },
            });
            response = `CON Wallet created:\n${wallet.address}\nSet a 4-digit PIN to continue:`;
            break;
          }

          default:
            response = /^\d{4}$/.test(input)
              ? `END Please create a wallet first.`
              : `END Invalid option.`;
        }

        return response;
      }

      if (!user.pinHash) {
        if (/^\d{4}$/.test(input)) {
          const hash = await bcrypt.hash(input, 10);
          await prisma.user.update({
            where: { phoneNumber: cleanPhone },
            data: { pinHash: hash },
          });
          response = `END PIN set successfully. You can now use Kudifi.`;
        } else {
          response = `CON Set a 4-digit PIN to proceed:`;
        }

        return response;
      }

      switch (true) {
        case input === "":
          response = `CON Welcome to Kudifi
1. Send tokens
2. Check balance
3. Buy tokens
4. View Rewards
5. View Wallet Address
6. Withdraw to Momo
7. Donate to Team`;
          break;

        case input === "2":
          response = `CON Choose token:\n1. APE\n2. USDT\n3. USDC`;
          break;

        case input === "2*1" || input === "2*2" || input === "2*3": {
          const token =
            input === "2*1" ? "APE" : input === "2*2" ? "USDT" : "USDC";
          const balance = await ThirdwebService.getTokenBalance(
            (user.smartWalletAddr || user.walletAddr) as Address,
            token
          );
          const rate = await PriceService.getTokenPriceInGHS(token);
          const value = (Number(balance) * rate).toFixed(2);
          response = `END Your ${token} balance is ${balance} (~GHS ${value})`;
          break;
        }

        case input === "1":
          response = `CON Choose token:\n1. APE\n2. USDT\n3. USDC`;
          break;

        case /^1\*[1-3]$/.test(input):
          response = `CON Enter recipient phone number (e.g. 054xxxxxxxx):`;
          break;

        case /^1\*[1-3]\*\d{10,13}$/.test(input): {
          const [_, tokenOpt, rawRecipientPhone] = input.split("*");
          
          if (!isValidGhanaianPhoneNumber(rawRecipientPhone)) {
            response = `END Invalid Ghanaian phone number. Please use format: 054xxxxxxxx.`;
            break;
          }

          response = `CON Enter amount to send:`;
          break;
        }

        case /^1\*[1-3]\*\d{10,13}\*\d+(\.\d+)?$/.test(input): {
          const [_, tokenOpt, rawRecipient, amountStr] = input.split("*");
          const token =
            tokenOpt === "1" ? "APE" : tokenOpt === "2" ? "USDT" : "USDC";
          const rate = await PriceService.getTokenPriceInGHS(token);
          const amount = Number(amountStr);
          const value = (amount * rate).toFixed(2);

          // Check balance before proceeding
          const balance = await ThirdwebService.getTokenBalance(
            (user.smartWalletAddr || user.walletAddr) as Address,
            token
          );
          if (Number(balance) < amount) {
            response = `END Not enough ${token} tokens to fulfill transaction.`;
            break;
          }

          response = `CON Sending ${amount} ${token} (~GHS ${value})\nEnter your 4-digit PIN:`;
          break;
        }

        case /^1\*[1-3]\*\d{10,13}\*\d+(\.\d+)?\*\d{4}$/.test(input): {
          const [_, tokenOpt, rawRecipientPhone, amountStr, pin] = input.split("*");
          const tokenMap = { "1": "APE", "2": "USDT", "3": "USDC" } as const;
          const token = tokenMap[tokenOpt as keyof typeof tokenMap];
          const selectedToken = supportedTokensMap[token];
          const amount = Number(amountStr);
          const recipientPhone = sanitizePhoneNumber(rawRecipientPhone);

          if (!isValidGhanaianPhoneNumber(rawRecipientPhone)) {
            response = `END Invalid phone number. Please use format: 054xxxxxxxx.`;
            break;
          }

          const retryKey = `pin-retry:${cleanPhone}`;
          const retryCount = parseInt((await redis.get(retryKey)) || "0");

          if (retryCount >= MAX_RETRIES) {
            return `END Too many incorrect PIN attempts. Try again later.`;
          }

          if (isNaN(amount) || amount <= 0) {
            return `END Invalid amount.`;
          }

          // Double-check balance before PIN verification
          const balance = await ThirdwebService.getTokenBalance(
            (user.smartWalletAddr || user.walletAddr) as Address,
            token
          );
          if (Number(balance) < amount) {
            return `END Not enough ${token} tokens to fulfill transaction.`;
          }

          const validPin = await bcrypt.compare(pin, user.pinHash!);
          if (!validPin) {
            await redis.setex(retryKey, 3600, (retryCount + 1).toString());
            return `END Incorrect PIN. Attempt ${retryCount + 1} of ${MAX_RETRIES}`;
          }

          await redis.del(retryKey);

          let recipient = await prisma.user.findUnique({
            where: { phoneNumber: recipientPhone },
          });

          if (!recipient) {
            const wallet = await ThirdwebService.createWallet();
            recipient = await prisma.user.create({
              data: {
                phoneNumber: recipientPhone,
                walletAddr: wallet.address,
                smartWalletAddr: wallet.smartAccountAddress,
              },
            });
          }

          await ThirdwebService.sendToken({
            from: (user.smartWalletAddr || user.walletAddr) as Address,
            to: (recipient.smartWalletAddr || recipient.walletAddr) as Address,
            tokenSymbol: selectedToken.symbol,
            amount: toUnits(amount.toString(), selectedToken.decimals),
          });

          response = `END Sent ${amount} ${token} to ${recipientPhone}`;
          break;
        }

        case input === "3":
          response = `CON Select token:\n1. APE\n2. USDT\n3. USDC`;
          break;

        case input === "3*1" || input === "3*2" || input === "3*3": {
          const token =
            input === "3*1" ? "APE" : input === "3*2" ? "USDT" : "USDC";
          response = `CON Enter amount in GHS to buy ${token}:`;
          break;
        }

        case /^3\*[1-3]\*\d+(\.\d+)?$/.test(input): {
          const [_, tokenOpt, amountStr] = input.split("*");
          const tokenMap = {
            "1": TokenSymbol.APE,
            "2": TokenSymbol.USDT,
            "3": TokenSymbol.USDC,
          };
          const token = tokenMap[tokenOpt as keyof typeof tokenMap];
          const amount = Number(amountStr);

          if (isNaN(amount) || amount <= 0) {
            response = `END Invalid amount.`;
          } else {
            const rate = await PriceService.getTokenPriceInGHS(token);
            const tokensToReceive = (amount / rate).toFixed(2);
            response = `CON Rate: 1 ${token} = ${rate} GHS\nYou’ll get ${tokensToReceive} ${token}.\n1. Confirm\n2. Cancel`;
          }
          break;
        }

        case /^3\*[1-3]\*\d+(\.\d+)?\*1$/.test(input): {
          const [_, tokenOpt, amountStr] = input.split("*");
          const tokenMap = {
            "1": TokenSymbol.APE,
            "2": TokenSymbol.USDT,
            "3": TokenSymbol.USDC,
          };
          const token = tokenMap[tokenOpt as keyof typeof tokenMap];
          const amount = Number(amountStr);

          await prisma.purchase.create({
            data: {
              userId: user.id,
              provider: "MTN",
              phoneNumber,
              tokenSymbol: token,
              amount,
              status: "PENDING",
            },
          });

          response = `END Your purchase of GHS ${amount} ${token} is being processed.`;
          break;
        }

        case /^3\*[1-3]\*\d+(\.\d+)?\*2$/.test(input): {
          response = `END Purchase cancelled.`;
          break;
        }

        // View Rewards
        case input === "4": {
          response = `END Coming soon`;
          break;
        }

        // View Wallet Address
        case input === "5": {
          const walletAddress = user.smartWalletAddr || user.walletAddr;
          response = `END Your Wallet Address:\n${walletAddress}`;
          break;
        }

        // Withdraw to Momo
        case input === "6": {
          response = `END Coming soon`;
          break;
        }

        // Donate to Team
        case input === "7": {
          response = `CON Send APE, USDT or USDC token to support team:\n1. APE\n2. USDT\n3. USDC`;
          break;
        }

        case input === "7*1" || input === "7*2" || input === "7*3": {
          const token =
            input === "7*1" ? "APE" : input === "7*2" ? "USDT" : "USDC";
          response = `CON Enter amount of ${token} to donate to support team:`;
          break;
        }

        case /^7\*[1-3]\*\d+(\.\d+)?$/.test(input): {
          const [_, tokenOpt, amountStr] = input.split("*");
          const token =
            tokenOpt === "1" ? "APE" : tokenOpt === "2" ? "USDT" : "USDC";
          const rate = await PriceService.getTokenPriceInGHS(token);
          const amount = Number(amountStr);
          const value = (amount * rate).toFixed(2);

          // Check balance before proceeding
          const balance = await ThirdwebService.getTokenBalance(
            (user.smartWalletAddr || user.walletAddr) as Address,
            token
          );
          if (Number(balance) < amount) {
            response = `END Not enough ${token} tokens to fulfill transaction.`;
            break;
          }

          response = `CON Donating ${amount} ${token} (~GHS ${value}) to team\nEnter your 4-digit PIN:`;
          break;
        }

        case /^7\*[1-3]\*\d+(\.\d+)?\*\d{4}$/.test(input): {
          const [_, tokenOpt, amountStr, pin] = input.split("*");
          const tokenMap = { "1": "APE", "2": "USDT", "3": "USDC" } as const;
          const token = tokenMap[tokenOpt as keyof typeof tokenMap];
          const selectedToken = supportedTokensMap[token];
          const amount = Number(amountStr);

          const retryKey = `pin-retry:${cleanPhone}`;
          const retryCount = parseInt((await redis.get(retryKey)) || "0");

          if (retryCount >= MAX_RETRIES) {
            return `END Too many incorrect PIN attempts. Try again later.`;
          }

          if (isNaN(amount) || amount <= 0) {
            return `END Invalid amount.`;
          }

          // Double-check balance before PIN verification
          const balance = await ThirdwebService.getTokenBalance(
            (user.smartWalletAddr || user.walletAddr) as Address,
            token
          );
          if (Number(balance) < amount) {
            return `END Not enough ${token} tokens to fulfill transaction.`;
          }

          const validPin = await bcrypt.compare(pin, user.pinHash!);
          if (!validPin) {
            await redis.setex(retryKey, 3600, (retryCount + 1).toString());
            return `END Incorrect PIN. Attempt ${retryCount + 1} of ${MAX_RETRIES}`;
          }

          await redis.del(retryKey);

          await ThirdwebService.sendToken({
            from: (user.smartWalletAddr || user.walletAddr) as Address,
            to: TEAM_WALLET_ADDRESS as Address,
            tokenSymbol: selectedToken.symbol,
            amount: toUnits(amount.toString(), selectedToken.decimals),
          });

          response = `END Thank you for donating ${amount} ${token} to the team!`;
          break;
        }

        default:
          response = `END Invalid option.`;
      }
    } catch (error) {
      console.error("Error processing request:", error);
      response = "An error occurred while processing your request.";
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