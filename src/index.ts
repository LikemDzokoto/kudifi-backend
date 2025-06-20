// imports
import { Elysia, t } from "elysia";
import swagger from "@elysiajs/swagger";

// configs
import { prisma } from "./configs";

// services
import { ThirdwebService } from "@/services";

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

    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    let response = "";
    const input = text.trim();

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
          response = `END Wallet created:\n${wallet.address}`;
          break;
        }

        default:
          response = `END Invalid option.`;
      }
    } else {
      switch (true) {
        case input === "":
          response = `CON Welcome to Kudifi\n1. View wallet\n2. Buy tokens`;
          break;

        case input === "1":
          response = `END Your wallet address is:\n${user.walletAddr}`;
          break;

        case input === "2":
          response = `CON Select token:\n1. USDT\n2. USDC`;
          break;

        case input === "2*1" || input === "2*2": {
          const token = input === "2*1" ? "USDT" : "USDC";
          response = `CON Enter amount in GHS to buy ${token}:`;
          break;
        }

        case /^2\*(1|2)\*\d+(\.\d+)?$/.test(input): {
          const [_, tokenOption, amountStr] = input.split("*");
          const token = tokenOption === "1" ? "USDT" : "USDC";
          const amount = Number(amountStr);

          if (isNaN(amount) || amount <= 0) {
            response = `END Invalid amount.`;
          } else {
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
          }
          break;
        }

        default:
          response = `END Invalid option.`;
      }
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
