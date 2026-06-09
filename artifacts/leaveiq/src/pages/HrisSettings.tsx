/**
 * HrisSettings — this page is retained for backward-compatibility with any
 * existing bookmarks, but HRIS integration configuration has moved to the
 * Super Admin panel. HR Admins manage employee data via the Employees page.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function HrisSettings() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/leave/employees");
  }, [navigate]);
  return null;
}
