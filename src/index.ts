import { Elysia, t } from "elysia";
import swagger from "@elysiajs/swagger";

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
  ({ body }) => {
    const { sessionId, serviceCode, phoneNumber, text } = body;

    let response = "";

    if (text == "") {
      // This is the first request. Note how we start the response with CON
      response = `CON What would you like to check
        1. My account
        2. My phone number`;
    } else if (text == "1") {
      // Business logic for first level response
      response = `CON Choose account information you want to view
        1. Account number`;
    } else if (text == "2") {
      // Business logic for first level response
      // This is a terminal request. Note how we start the response with END
      response = `END Your phone number is ${phoneNumber}`;
    } else if (text == "1*1") {
      // This is a second level response where the user selected 1 in the first instance
      const accountNumber = "ACC100101";
      // This is a terminal request. Note how we start the response with END
      response = `END Your account number is ${accountNumber}`;
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
