import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import authRouter from "./auth";
import interestRouter from "./interest";
import aiAgentRouter from "./aiAgent";
import superAdminRouter from "./superAdmin";
import knowledgeRouter from "./knowledge";
import hrisRouter from "./hris";
import portalRouter from "./portal";
import orgRouter from "./org";
import piqRouter from "./piq/index.js";
import employeesRouter from "./employees.js";
import caseMessagesRouter from "./caseMessages.js";

const router: IRouter = Router();

router.use(employeesRouter);
router.use(healthRouter);
router.use(authRouter);
router.use(casesRouter);
router.use(aiAgentRouter);
router.use(interestRouter);
router.use(superAdminRouter);
router.use(knowledgeRouter);
router.use(hrisRouter);
router.use(portalRouter);
router.use(orgRouter);
router.use(piqRouter);
router.use(caseMessagesRouter);

export default router;
