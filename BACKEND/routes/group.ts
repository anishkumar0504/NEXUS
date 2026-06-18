import express from "express";
import { middleware } from "../middleware/middleware.js";
import {
  createGroup,
  joinGroup,
  getGroup,
  postMessage,
  getMessages,
} from "../controllers/groupController.js";

const groupRouter = express.Router();

groupRouter.use(middleware);

groupRouter.post("/", createGroup);
groupRouter.post("/:groupId/join", joinGroup);
groupRouter.get("/:groupId", getGroup);
groupRouter.post("/:groupId/message", postMessage);
groupRouter.get("/:groupId/messages", getMessages);

export default groupRouter;