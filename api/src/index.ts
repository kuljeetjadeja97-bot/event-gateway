import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  process.stdout.write(`event-gateway listening on ${port}\n`);
});
