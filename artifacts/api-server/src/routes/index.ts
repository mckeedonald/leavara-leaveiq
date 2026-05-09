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
import adaRouter from "./ada.js";
import publicRouter from "./publicRoutes.js";

const router: IRouter = Router();

// Public routes must come before any auth middleware
router.use(publicRouter);
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
router.use(adaRouter);

export default router;
