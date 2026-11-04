import { Award, BadgeCheck, BriefcaseBusiness, Camera, CircleDashed, Earth, FileText, GraduationCap, Languages, Link2, ShieldCheck, Smartphone, UserRound } from 'lucide-react'

const ICONS = {
  basics: UserRound,
  work_history: BriefcaseBusiness,
  education: GraduationCap,
  languages: Languages,
  right_to_work: Earth,
  photo: Camera,
  links: Link2,
  live_cv: FileText,
  phone: Smartphone,
  check_identity: ShieldCheck,
  check_academic: Award,
  check_employment: BadgeCheck,
}

/** The icon for a completeness checklist item (§3.2); a dashed circle for a key the client does not know yet. */
export const completenessIcon = (key) => ICONS[key] ?? CircleDashed
