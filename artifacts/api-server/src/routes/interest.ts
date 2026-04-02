import { Router, type IRouter, type Request, type Response } from "express";
import { sendInterestEmail } from "../lib/email";

const router: IRouter = Router();

router.post("/interest", async (req: Request, res: Response): Promise<void> => {
  const { companyName, contactName, title, email, phone, companySize, message } = req.body as {
    companyName?: string;
    contactName?: string;
    title?: string;
    email?: string;
    phone?: string;
    companySize?: string;
    message?: string;
  };

  if (!companyName?.trim() || !contactName?.trim() || !email?.trim() || !companySize?.trim()) {
    res.status(400).json({ error: "Company name, contact name, email, and company size are required." });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    res.status(400).json({ error: "Please provide a valid email address." });
    return;
  }

  await sendInterestEmail({
    companyName: companyName.trim(),
    contactName: contactName.trim(),
    title: title?.trim(),
    email: email.trim(),
    phone: phone?.trim(),
    companySize: companySize.trim(),
    message: message?.trim(),
  }).catch((err) => req.log.error({ err }, "Failed to send interest notification email"));

  res.status(201).json({ message: "Thank you for your interest. We'll be in touch shortly." });
});

export default router;
