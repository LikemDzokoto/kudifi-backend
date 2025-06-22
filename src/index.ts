// imports
import * as bcrypt from "bcrypt";
import { Elysia, t } from "elysia";
import swagger from "@elysiajs/swagger";
import { Address, toUnits } from "thirdweb";

// configs
import { prisma } from "./configs";

// services
import { ThirdwebService, PriceService } from "@/services";

// constants
import { supportedTokensMap } from "@/constants";

// types
import { TokenSymbol } from "@/generated/prisma";

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
    const { sessionId, serviceCode, phoneNumber, text } = body;
    const input = text.trim();
    const user = await prisma.user.findUnique({ where: { phoneNumber } });

    let response = "";

    // 🧑🏾‍💻 First-time user
    if (!user) {
      switch (input) {
        case "":
          response = `CON Welcome to Kudifi\n1. Create wallet`;
          break;

        case "1": {
          const wallet = await ThirdwebService.createWallet();
          await prisma.user.create({
            data: {
              phoneNumber,
              walletAddr: wallet.address,
              smartWalletAddr: wallet.smartAccountAddress,
            },
          });
          response = `CON Wallet created:\n${wallet.address}\nSet a 4-digit PIN to continue:`;
          break;
        }

        default:
          // assume they're setting PIN too early
          response = /^\d{4}$/.test(input)
            ? `END Please create a wallet first.`
            : `END Invalid option.`;
      }

      return response;
    }

    // 🛡️ Block access if wallet exists but no PIN set
    if (!user.pinHash) {
      if (/^\d{4}$/.test(input)) {
        const hash = await bcrypt.hash(input, 10);
        await prisma.user.update({
          where: { phoneNumber },
          data: { pinHash: hash },
        });
        response = `END PIN set successfully. You can now use Kudifi.`;
      } else {
        response = `CON Set a 4-digit PIN to proceed:`;
      }

      return response;
    }

    // ✅ Fully registered user
    switch (true) {
      case input === "":
        response = `CON Welcome to Kudifi\n1. Send tokens\n2. Check balance\n3. Buy tokens`;
        break;

      // 📦 View balance
      case input === "2":
        response = `CON Choose token:\n1. APE\n2. USDT\n3. USDC`;
        break;

      case input === "2*1" || input === "2*2" || input === "2*3": {
        const token =
          input === "2*1" ? "APE" : input === "2*2" ? "USDT" : "USDC";
        const balance = await ThirdwebService.getTokenBalance(
          user.walletAddr as Address,
          token
        );
        response = `END Your ${token} balance is ${balance}`;
        break;
      }

      // 💸 Send flow
      case input === "1":
        response = `CON Choose token:\n1. APE\n2. USDT\n3. USDC`;
        break;

      case /^1\*[1-3]$/.test(input):
        response = `CON Enter recipient phone number (e.g. 054xxxxxxxx):`;
        break;

      case /^1\*[1-3]\*\d{10,13}$/.test(input):
        response = `CON Enter amount to send:`;
        break;

      case /^1\*[1-3]\*\d{10,13}\*\d+(\.\d+)?$/.test(input):
        response = `CON Enter your 4-digit PIN:`;
        break;

      case /^1\*[1-3]\*\d{10,13}\*\d+(\.\d+)?\*\d{4}$/.test(input): {
        const [_, tokenOpt, recipientPhone, amountStr, pin] = input.split("*");
        const tokenMap = { "1": "APE", "2": "USDT", "3": "USDC" };
        const token = tokenMap[tokenOpt as keyof typeof tokenMap];
        const selectedToken =
          supportedTokensMap[token as keyof typeof supportedTokensMap];
        const amount = Number(amountStr);
        const recipient = await prisma.user.findUnique({
          where: { phoneNumber: recipientPhone },
        });

        if (!recipient) {
          response = `END Recipient not found.`;
        } else if (isNaN(amount) || amount <= 0) {
          response = `END Invalid amount.`;
        } else {
          const validPin = await bcrypt.compare(pin, user.pinHash!);
          if (!validPin) {
            response = `END Incorrect PIN.`;
          } else {
            await ThirdwebService.sendToken({
              from: user.walletAddr as Address,
              to: recipient.walletAddr as Address,
              tokenSymbol: selectedToken.symbol,
              amount: toUnits(amount.toString(), selectedToken.decimals),
            });
            response = `END Sent ${amount} ${token} to ${recipientPhone}`;
          }
        }
        break;
      }

      // 🛍️ Buy token flow
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

      default:
        response = `END Invalid option.`;
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
