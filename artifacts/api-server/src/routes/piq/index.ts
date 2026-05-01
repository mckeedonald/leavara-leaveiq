import { Router } from "express";
import authRouter from "./auth.js";
import casesRouter from "./cases.js";
import employeesRouter from "./employees.js";
import workflowRouter from "./workflow.js";
import agentRouter from "./agent.js";
import adminRouter from "./admin.js";
import signaturesRouter from "./signatures.js";

const router = Router();

router.use(authRouter);
router.use(casesRouter);
router.use(employeesRouter);
router.use(workflowRouter);
router.use(agentRouter);
router.use(adminRouter);
router.use(signaturesRouter);

export default router;
