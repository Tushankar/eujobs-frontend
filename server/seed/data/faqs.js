/* FAQs per audience for seed:catalog (M-200, U43): rewritten from the product rules, no demo text. Order = array order. */
export const FAQS = [
  {
    audiences: ['candidate'],
    question: {
      en: 'What do I need before I can apply to a job?',
      es: '¿Qué necesito para postularme a una oferta?',
      fr: 'De quoi ai-je besoin pour postuler à une offre ?',
    },
    answer: {
      en: 'Applying needs the Plus plan and a complete profile: work history, education, languages, right to work, a photo or links, a live CV, a confirmed phone number and approved verification checks. When something is missing, the Apply button lists it for you.',
      es: 'Para postularte necesitas el plan Plus y un perfil completo: experiencia, formación, idiomas, permiso de trabajo, una foto o enlaces, un CV activo, un teléfono confirmado y las verificaciones aprobadas. Si falta algo, el botón Postularme te lo indica.',
      fr: 'Pour postuler, il faut le plan Plus et un profil complet : expérience, formation, langues, droit au travail, une photo ou des liens, un CV actif, un téléphone confirmé et des vérifications approuvées. S’il manque quelque chose, le bouton Postuler vous l’indique.',
    },
  },
  {
    audiences: ['candidate'],
    question: { en: 'What does Plus include?', es: '¿Qué incluye Plus?', fr: 'Que comprend Plus ?' },
    answer: {
      en: 'Plus lets you apply to jobs, message recruiters, receive job alerts by email and use every AI feature, such as match scores, explanations and CV help. You can cancel at any time in Settings > Billing, and Plus stays active until the end of the paid month.',
      es: 'Plus te permite postularte a ofertas, escribir a los reclutadores, recibir alertas de empleo por correo y usar todas las funciones de IA, como las puntuaciones de compatibilidad, las explicaciones y la ayuda con el CV. Puedes cancelarlo cuando quieras en Configuración > Facturación, y Plus sigue activo hasta el final del mes pagado.',
      fr: 'Plus vous permet de postuler, d’écrire aux recruteurs, de recevoir des alertes emploi par e-mail et d’utiliser toutes les fonctions d’IA, comme les scores de compatibilité, les explications et l’aide pour le CV. Vous pouvez résilier à tout moment dans Paramètres > Facturation ; Plus reste actif jusqu’à la fin du mois payé.',
    },
  },
  {
    audiences: ['candidate'],
    question: { en: 'How does verification work?', es: '¿Cómo funciona la verificación?', fr: 'Comment fonctionne la vérification ?' },
    answer: {
      en: 'On the Verification page you upload evidence for your identity, education, employment, right to work and certificates. Our team reviews each check and emails you the result. Uploaded documents are deleted 30 days after the decision.',
      es: 'En la página Verificación subes pruebas de tu identidad, formación, experiencia, permiso de trabajo y certificados. Nuestro equipo revisa cada comprobación y te envía el resultado por correo. Los documentos subidos se eliminan 30 días después de la decisión.',
      fr: 'Sur la page Vérification, vous téléversez des justificatifs pour votre identité, vos diplômes, votre expérience, votre droit au travail et vos certificats. Notre équipe examine chaque vérification et vous envoie le résultat par e-mail. Les documents sont supprimés 30 jours après la décision.',
    },
  },
  {
    audiences: ['candidate'],
    question: { en: 'Who can see my profile?', es: '¿Quién puede ver mi perfil?', fr: 'Qui peut voir mon profil ?' },
    answer: {
      en: 'Recruiters can find you in candidate search while your profile is discoverable, and companies you apply to see your application. You choose profile visibility, CV visibility and matching consent in Settings > Privacy.',
      es: 'Los reclutadores pueden encontrarte en la búsqueda de candidatos mientras tu perfil sea visible, y las empresas a las que te postulas ven tu candidatura. Eliges la visibilidad del perfil, la del CV y el consentimiento de compatibilidad en Configuración > Privacidad.',
      fr: 'Les recruteurs peuvent vous trouver dans la recherche de candidats tant que votre profil est visible, et les entreprises auxquelles vous postulez voient votre candidature. Vous choisissez la visibilité du profil, celle du CV et le consentement à la mise en correspondance dans Paramètres > Confidentialité.',
    },
  },
  {
    audiences: ['candidate'],
    question: { en: 'How are job matches worked out?', es: '¿Cómo se calculan las coincidencias?', fr: 'Comment les correspondances sont-elles calculées ?' },
    answer: {
      en: 'We compare your reviewed profile and live CV with each job’s skills, experience and location. With Plus you see the score and why a job fits. Recruiters see a ranking and the evidence, never your score, and people always make the hiring decision.',
      es: 'Comparamos tu perfil revisado y tu CV activo con las habilidades, la experiencia y la ubicación de cada oferta. Con Plus ves la puntuación y por qué encaja una oferta. Los reclutadores ven una clasificación y las pruebas, nunca tu puntuación, y las decisiones de contratación siempre las toman personas.',
      fr: 'Nous comparons votre profil vérifié et votre CV actif aux compétences, à l’expérience et au lieu de chaque offre. Avec Plus, vous voyez le score et pourquoi une offre vous correspond. Les recruteurs voient un classement et les éléments justificatifs, jamais votre score, et ce sont toujours des personnes qui décident.',
    },
  },
  {
    audiences: ['recruiter'],
    question: {
      en: 'Why can’t I use the recruiter workspace yet?',
      es: '¿Por qué aún no puedo usar el espacio de reclutador?',
      fr: 'Pourquoi ne puis-je pas encore utiliser l’espace recruteur ?',
    },
    answer: {
      en: 'Every recruiter account is reviewed first. Confirm your work email, add your company, upload the company documents, confirm your phone and submit. Our team approves the account and emails you the decision.',
      es: 'Revisamos cada cuenta de reclutador antes de abrirla. Confirma tu correo de trabajo, añade tu empresa, sube los documentos de la empresa, confirma tu teléfono y envía la solicitud. Nuestro equipo aprueba la cuenta y te envía la decisión por correo.',
      fr: 'Chaque compte recruteur est d’abord examiné. Confirmez votre e-mail professionnel, ajoutez votre entreprise, téléversez les documents de l’entreprise, confirmez votre téléphone et envoyez la demande. Notre équipe approuve le compte et vous envoie la décision par e-mail.',
    },
  },
  {
    audiences: ['recruiter'],
    question: { en: 'How do I find candidates?', es: '¿Cómo encuentro candidatos?', fr: 'Comment trouver des candidats ?' },
    answer: {
      en: 'Find candidates lists the discoverable candidates in the country chosen in your header. Open a profile to see the evidence for your job, add the candidate to your shortlist, keep private notes or send a message.',
      es: 'Buscar candidatos muestra los candidatos visibles del país elegido en la cabecera. Abre un perfil para ver las pruebas frente a tu oferta, añade al candidato a tu preselección, guarda notas privadas o envía un mensaje.',
      fr: 'Trouver des candidats affiche les candidats visibles du pays choisi dans l’en-tête. Ouvrez un profil pour voir les éléments par rapport à votre offre, ajoutez le candidat à votre présélection, prenez des notes privées ou envoyez un message.',
    },
  },
  {
    audiences: ['recruiter'],
    question: { en: 'Do recruiters pay for AI features?', es: '¿Los reclutadores pagan por las funciones de IA?', fr: 'Les recruteurs paient-ils les fonctions d’IA ?' },
    answer: {
      en: 'No. AI summaries, match evidence and translation are included for approved recruiters. Only candidates have a paid plan; courses are bought separately.',
      es: 'No. Los resúmenes de IA, las pruebas de compatibilidad y la traducción están incluidos para los reclutadores aprobados. Solo los candidatos tienen un plan de pago; los cursos se compran aparte.',
      fr: 'Non. Les résumés par IA, les éléments de correspondance et la traduction sont inclus pour les recruteurs approuvés. Seuls les candidats ont un plan payant ; les formations s’achètent à part.',
    },
  },
  {
    audiences: ['admin'],
    question: { en: 'How do roles and permissions work?', es: '¿Cómo funcionan los roles y los permisos?', fr: 'Comment fonctionnent les rôles et les autorisations ?' },
    answer: {
      en: 'Each administrator has a role with a set of permissions, and individual permissions can be added or removed in Access management. Owners hold every permission. Pages and actions you cannot use are hidden.',
      es: 'Cada administrador tiene un rol con un conjunto de permisos, y en Gestión de accesos se pueden añadir o quitar permisos concretos. Los propietarios tienen todos los permisos. Las páginas y acciones que no puedes usar se ocultan.',
      fr: 'Chaque administrateur a un rôle avec un ensemble d’autorisations, et des autorisations individuelles peuvent être ajoutées ou retirées dans Gestion des accès. Les propriétaires disposent de toutes les autorisations. Les pages et actions que vous ne pouvez pas utiliser sont masquées.',
    },
  },
  {
    audiences: ['admin'],
    question: { en: 'How do I add another administrator?', es: '¿Cómo añado otro administrador?', fr: 'Comment ajouter un autre administrateur ?' },
    answer: {
      en: 'In Access management, invite the person by email and choose their role. The invitation link works once and expires after 72 hours.',
      es: 'En Gestión de accesos, invita a la persona por correo y elige su rol. El enlace de invitación solo funciona una vez y caduca a las 72 horas.',
      fr: 'Dans Gestion des accès, invitez la personne par e-mail et choisissez son rôle. Le lien d’invitation ne fonctionne qu’une fois et expire au bout de 72 heures.',
    },
  },
  {
    audiences: ['candidate', 'recruiter'],
    question: {
      en: 'How do I change my language or country?',
      es: '¿Cómo cambio el idioma o el país?',
      fr: 'Comment changer de langue ou de pays ?',
    },
    answer: {
      en: 'Use the pickers in the header or in your profile menu. The country sets which jobs and candidates you see, the currency and the date and number formats. The language is used for the app and for our emails.',
      es: 'Usa los selectores de la cabecera o del menú de perfil. El país determina qué ofertas y candidatos ves, la moneda y el formato de fechas y números. El idioma se usa en la aplicación y en nuestros correos.',
      fr: 'Utilisez les sélecteurs de l’en-tête ou du menu de profil. Le pays détermine les offres et les candidats affichés, la devise et le format des dates et des nombres. La langue s’applique à l’application et à nos e-mails.',
    },
  },
  {
    audiences: ['admin'],
    question: {
      en: 'How do I change my name, password or language?',
      es: '¿Cómo cambio mi nombre, mi contraseña o el idioma?',
      fr: 'Comment changer mon nom, mon mot de passe ou la langue ?',
    },
    answer: {
      en: 'Open Settings from the sidebar or your profile menu. Changes to your name and language apply straight away.',
      es: 'Abre Configuración desde la barra lateral o el menú de perfil. Los cambios de nombre e idioma se aplican al momento.',
      fr: 'Ouvrez Paramètres depuis la barre latérale ou votre menu de profil. Les changements de nom et de langue s’appliquent immédiatement.',
    },
  },
  {
    audiences: ['candidate', 'recruiter', 'admin'],
    question: { en: 'I forgot my password. What do I do?', es: 'He olvidado mi contraseña. ¿Qué hago?', fr: 'J’ai oublié mon mot de passe. Que faire ?' },
    answer: {
      en: 'Choose “Forgot password?” on the sign-in page and enter your email address. The link we send works once and expires after 1 hour. Setting a new password signs you out on every device.',
      es: 'Elige «¿Has olvidado tu contraseña?» en la página de inicio de sesión e introduce tu correo. El enlace que te enviamos solo funciona una vez y caduca en 1 hora. Al crear una nueva contraseña se cierra tu sesión en todos los dispositivos.',
      fr: 'Choisissez « Mot de passe oublié ? » sur la page de connexion et saisissez votre adresse e-mail. Le lien envoyé ne fonctionne qu’une fois et expire au bout d’1 heure. Définir un nouveau mot de passe vous déconnecte sur tous vos appareils.',
    },
  },
]
