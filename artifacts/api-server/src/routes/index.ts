import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import authRouter from "./auth";
import interestRouter from "./interest";
import aiAgentRouter from "./aiAgent";
import superAdminRouter from "./superAdmin";
import knowledgeRouter from "./knowledge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(casesRouter);
router.use(aiAgentRouter);
router.use(interestRouter);
router.use(superAdminRouter);
router.use(knowledgeRouter);

export default router;
