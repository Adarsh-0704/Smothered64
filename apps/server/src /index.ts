import express from "express";
import dotenv from "dotenv";
import v1Router from "./router/v1.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/v1", v1Router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});