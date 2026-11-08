export const DEPARTMENTS: Record<string, string[]> = {
  "Management Team": ["Founder / Owner", "Co-Founder", "CEO", "Admin", "HR Manager", "Project Manager", "Team Leader"],
  "Development Team": ["Frontend Developer", "Backend Developer", "Full Stack Developer", "WordPress Developer", "Laravel Developer", "React Developer", "Next.js Developer", "PHP Developer", "Mobile App Developer"],
  "Design Team": ["UI/UX Designer", "Web Designer", "Graphic Designer", "Logo Designer", "Figma Designer"],
  "Marketing Team": ["Digital Marketing Manager", "SEO Specialist", "Social Media Manager", "Content Writer", "Copywriter"],
  "Testing & Support Team": ["QA Tester", "Bug Tester", "Security Specialist", "Technical Support", "Database Administrator", "DevOps Engineer"],
  "Other Members": ["Video Editor", "Animator", "Data Entry Operator", "Client Manager", "Intern / Trainee", "Freelancer"],
};

export const STAFF_ROLES = ["super_admin", "admin", "hr", "pm", "leader", "member", "accountant", "support"];
export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", hr: "HR Manager", pm: "Project Manager", leader: "Team Leader",
  member: "Team Member (Developer / Designer)", accountant: "Accountant", support: "Support Agent", client: "Client",
};
export const MODULES = ["members", "clients", "projects", "tasks", "finance", "tickets", "recruitment", "reports", "notices", "settings", "roles"];
export const MODULE_LABEL: Record<string, string> = {
  members: "Team Members", clients: "Clients", projects: "Projects", tasks: "Tasks", finance: "Finance & Invoices", tickets: "Support Tickets",
  recruitment: "Recruitment / HR", reports: "Reports & Logs", notices: "Notice Board", settings: "Website Settings", roles: "Roles & Permissions",
};
export const CATEGORIES = ["Business Website", "E-commerce Website", "Portfolio Website", "Landing Page", "Web Application", "WordPress Website", "Custom Software", "Mobile Application", "Maintenance Project"];
