/*
 * Legal drafts for seed:catalog (M-191, OD12): Terms, Privacy and an Imprint placeholder in en/es/fr,
 * version 2026-11-draft, marked as drafts. Final wording comes before go-live (§8, P15).
 */
export const LEGAL_VERSION = '2026-11-draft'

export const LEGAL_DOCUMENTS = {
  terms: {
    en: {
      title: 'Terms of Service',
      body: `## About these terms
Local WorkMan is a job portal for the EU and the UK that connects candidates with recruiters and uses AI to suggest matches. These terms apply when you create an account or use the service.

## Your account
- Each account has one role: candidate, recruiter or administrator.
- Give accurate information, confirm your email address and keep your password to yourself.
- Recruiter accounts are reviewed by our team before the recruiting tools open.

## Using the service
- Do not post unlawful, discriminatory, misleading or offensive content.
- Jobs must be real, open positions. Recruiters contact candidates only about genuine opportunities.
- Anyone can report content. Our team may restrict content or suspend accounts that break these terms.

## AI features
Match scores, summaries and suggestions are generated to help you decide. They can be wrong. Hiring decisions are always made by people, and candidates can turn matching off in their privacy settings.

## Plus and courses
Plus is a monthly subscription for candidates. Prices include VAT and are charged through Stripe. You can cancel at any time in Billing; Plus then stays active until the end of the paid period. Courses are one-time purchases.

## Ending your account
You can delete your account at any time in Settings. We may suspend an account that breaks these terms and will tell you why.

## Liability
We provide the service with reasonable care. Nothing in these terms limits the rights you have under the consumer law of your country.

## Changes
When these terms change, we ask you to accept the new version the next time you sign in.`,
    },
    es: {
      title: 'Condiciones del servicio',
      body: `## Sobre estas condiciones
Local WorkMan es un portal de empleo para la UE y el Reino Unido que pone en contacto a candidatos y reclutadores y usa IA para sugerir coincidencias. Estas condiciones se aplican cuando creas una cuenta o usas el servicio.

## Tu cuenta
- Cada cuenta tiene un solo rol: candidato, reclutador o administrador.
- Facilita información correcta, confirma tu correo electrónico y no compartas tu contraseña.
- Nuestro equipo revisa las cuentas de reclutador antes de abrir las herramientas de selección.

## Uso del servicio
- No publiques contenido ilegal, discriminatorio, engañoso u ofensivo.
- Las ofertas deben ser puestos reales y abiertos. Los reclutadores solo contactan a candidatos por oportunidades auténticas.
- Cualquiera puede denunciar contenido. Nuestro equipo puede restringir contenido o suspender cuentas que incumplan estas condiciones.

## Funciones de IA
Las puntuaciones de compatibilidad, los resúmenes y las sugerencias se generan para ayudarte a decidir. Pueden contener errores. Las decisiones de contratación siempre las toman personas, y los candidatos pueden desactivar la compatibilidad en su configuración de privacidad.

## Plus y cursos
Plus es una suscripción mensual para candidatos. Los precios incluyen el IVA y se cobran a través de Stripe. Puedes cancelarla en cualquier momento en Facturación; Plus sigue activo hasta el final del periodo pagado. Los cursos son compras únicas.

## Cierre de tu cuenta
Puedes eliminar tu cuenta en cualquier momento en Configuración. Podemos suspender una cuenta que incumpla estas condiciones y te explicaremos el motivo.

## Responsabilidad
Prestamos el servicio con una diligencia razonable. Nada de estas condiciones limita los derechos que te reconoce la legislación de consumo de tu país.

## Cambios
Cuando estas condiciones cambien, te pediremos que aceptes la nueva versión la próxima vez que inicies sesión.`,
    },
    fr: {
      title: 'Conditions d’utilisation',
      body: `## À propos de ces conditions
Local WorkMan est un portail emploi pour l’UE et le Royaume-Uni qui met en relation candidats et recruteurs et utilise l’IA pour proposer des correspondances. Ces conditions s’appliquent lorsque vous créez un compte ou utilisez le service.

## Votre compte
- Chaque compte a un seul rôle : candidat, recruteur ou administrateur.
- Fournissez des informations exactes, confirmez votre adresse e-mail et gardez votre mot de passe pour vous.
- Notre équipe examine les comptes recruteurs avant d’ouvrir les outils de recrutement.

## Utilisation du service
- Ne publiez pas de contenu illégal, discriminatoire, trompeur ou offensant.
- Les offres doivent correspondre à de vrais postes ouverts. Les recruteurs ne contactent les candidats que pour de vraies opportunités.
- Chacun peut signaler un contenu. Notre équipe peut restreindre un contenu ou suspendre un compte qui enfreint ces conditions.

## Fonctions d’IA
Les scores de compatibilité, les résumés et les suggestions sont générés pour vous aider à décider. Ils peuvent comporter des erreurs. Les décisions de recrutement sont toujours prises par des personnes, et les candidats peuvent désactiver la mise en correspondance dans leurs paramètres de confidentialité.

## Plus et formations
Plus est un abonnement mensuel pour les candidats. Les prix incluent la TVA et sont facturés via Stripe. Vous pouvez résilier à tout moment dans Facturation ; Plus reste actif jusqu’à la fin de la période payée. Les formations sont des achats uniques.

## Fermeture de votre compte
Vous pouvez supprimer votre compte à tout moment dans Paramètres. Nous pouvons suspendre un compte qui enfreint ces conditions et nous vous en expliquerons la raison.

## Responsabilité
Nous fournissons le service avec un soin raisonnable. Rien dans ces conditions ne limite les droits que vous accorde le droit de la consommation de votre pays.

## Modifications
Lorsque ces conditions changent, nous vous demandons d’accepter la nouvelle version lors de votre prochaine connexion.`,
    },
  },
  privacy: {
    en: {
      title: 'Privacy Policy',
      body: `## Who we are
Local WorkMan runs this job portal. The operator's details are in the [Imprint](/legal/imprint).

## What we collect
- **Account:** name, email address, password (stored only as a secure hash), language, country and time zone.
- **Candidate profile:** experience, education, skills, languages, right to work, photo, links and CV versions.
- **Verification and company checks:** identity, education, employment and right-to-work evidence; recruiters' company and registration documents.
- **Activity:** applications, messages, job alerts, course progress and the emails we send you.
- **Payments:** handled by Stripe. We keep the payment record and receipt link, never your card number.

## Why we use it
To run your account, show relevant jobs or candidates, review verification and company checks, process payments, send the emails you need, keep the service safe and meet legal obligations.

## Who can see it
- Recruiters see your profile when you apply to them, or in candidate search if your profile is discoverable.
- Service providers process data for us: MongoDB Atlas (database hosting), Stripe (payments), OpenAI (AI features) and Google (email delivery).
- When you search for a city, the letters you type are sent to Google Places to suggest places. Only the place you pick is saved with your data.

## How long we keep it
We keep your data while your account exists. Identity, company and evidence documents are deleted 30 days after our review decision. Payment records are kept as long as the law requires.

## Your choices and rights
- In Settings you control profile visibility, CV visibility and matching consent.
- You can download your data and delete your account at any time.
- You can ask us to access, correct or restrict your data, object to its use, and complain to your data protection authority.

## Browser storage
We use no tracking cookies. Your browser keeps your sign-in token and, before you sign in, your language and country choice.

## Changes
When this policy changes, we ask you to accept the new version the next time you sign in.`,
    },
    es: {
      title: 'Política de privacidad',
      body: `## Quiénes somos
Local WorkMan gestiona este portal de empleo. Los datos del responsable están en el [Aviso legal](/legal/imprint).

## Qué datos recogemos
- **Cuenta:** nombre, correo electrónico, contraseña (guardada solo como un hash seguro), idioma, país y zona horaria.
- **Perfil de candidato:** experiencia, formación, habilidades, idiomas, permiso de trabajo, foto, enlaces y versiones del CV.
- **Verificaciones y comprobaciones de empresa:** pruebas de identidad, formación, empleo y permiso de trabajo; documentos de empresa y de registro de los reclutadores.
- **Actividad:** candidaturas, mensajes, alertas de empleo, progreso en cursos y los correos que te enviamos.
- **Pagos:** los gestiona Stripe. Guardamos el registro del pago y el enlace al recibo, nunca el número de tu tarjeta.

## Para qué los usamos
Para gestionar tu cuenta, mostrarte ofertas o candidatos relevantes, revisar las verificaciones y las comprobaciones de empresa, procesar pagos, enviarte los correos necesarios, mantener la seguridad del servicio y cumplir obligaciones legales.

## Quién puede verlos
- Los reclutadores ven tu perfil cuando te postulas a sus ofertas, o en la búsqueda de candidatos si tu perfil es visible.
- Algunos proveedores tratan datos por nosotros: MongoDB Atlas (alojamiento de la base de datos), Stripe (pagos), OpenAI (funciones de IA) y Google (envío de correos).
- Cuando buscas una ciudad, las letras que escribes se envían a Google Places para sugerir lugares. Solo se guarda con tus datos el lugar que eliges.

## Cuánto tiempo los conservamos
Conservamos tus datos mientras exista tu cuenta. Los documentos de identidad, de empresa y las pruebas se eliminan 30 días después de nuestra decisión. Los registros de pago se conservan el tiempo que exija la ley.

## Tus opciones y derechos
- En Configuración controlas la visibilidad del perfil, la visibilidad del CV y el consentimiento de compatibilidad.
- Puedes descargar tus datos y eliminar tu cuenta en cualquier momento.
- Puedes pedirnos acceder a tus datos, rectificarlos o limitarlos, oponerte a su uso y presentar una reclamación ante tu autoridad de protección de datos.

## Almacenamiento en el navegador
No usamos cookies de seguimiento. Tu navegador guarda tu token de sesión y, antes de iniciar sesión, el idioma y el país que elijas.

## Cambios
Cuando esta política cambie, te pediremos que aceptes la nueva versión la próxima vez que inicies sesión.`,
    },
    fr: {
      title: 'Politique de confidentialité',
      body: `## Qui nous sommes
Local WorkMan exploite ce portail emploi. Les coordonnées de l’exploitant figurent dans les [Mentions légales](/legal/imprint).

## Les données que nous collectons
- **Compte :** nom, adresse e-mail, mot de passe (conservé uniquement sous forme de hachage sécurisé), langue, pays et fuseau horaire.
- **Profil candidat :** expérience, formation, compétences, langues, droit au travail, photo, liens et versions du CV.
- **Vérifications et contrôles d’entreprise :** justificatifs d’identité, de diplôme, d’emploi et de droit au travail ; documents d’entreprise et d’immatriculation des recruteurs.
- **Activité :** candidatures, messages, alertes emploi, progression dans les formations et e-mails que nous vous envoyons.
- **Paiements :** gérés par Stripe. Nous conservons l’enregistrement du paiement et le lien vers le reçu, jamais votre numéro de carte.

## Pourquoi nous les utilisons
Pour gérer votre compte, afficher des offres ou des candidats pertinents, examiner les vérifications et les contrôles d’entreprise, traiter les paiements, envoyer les e-mails nécessaires, assurer la sécurité du service et respecter nos obligations légales.

## Qui peut les voir
- Les recruteurs voient votre profil lorsque vous postulez chez eux, ou dans la recherche de candidats si votre profil est visible.
- Des prestataires traitent des données pour notre compte : MongoDB Atlas (hébergement de la base de données), Stripe (paiements), OpenAI (fonctions d’IA) et Google (envoi des e-mails).
- Lorsque vous recherchez une ville, les lettres saisies sont envoyées à Google Places pour proposer des lieux. Seul le lieu choisi est enregistré avec vos données.

## Durée de conservation
Nous conservons vos données tant que votre compte existe. Les documents d’identité, d’entreprise et les justificatifs sont supprimés 30 jours après notre décision. Les enregistrements de paiement sont conservés aussi longtemps que la loi l’exige.

## Vos choix et vos droits
- Dans Paramètres, vous contrôlez la visibilité du profil, la visibilité du CV et le consentement à la mise en correspondance.
- Vous pouvez télécharger vos données et supprimer votre compte à tout moment.
- Vous pouvez nous demander d’accéder à vos données, de les rectifier ou d’en limiter l’usage, vous opposer à leur utilisation et saisir votre autorité de protection des données.

## Stockage dans le navigateur
Nous n’utilisons aucun cookie de suivi. Votre navigateur conserve votre jeton de connexion et, avant la connexion, la langue et le pays choisis.

## Modifications
Lorsque cette politique change, nous vous demandons d’accepter la nouvelle version lors de votre prochaine connexion.`,
    },
  },
  imprint: {
    en: {
      title: 'Imprint',
      body: `## Placeholder
This imprint is a placeholder. The legal entity name, address, registration details and contact information will be added before the service goes live.`,
    },
    es: {
      title: 'Aviso legal',
      body: `## Texto provisional
Este aviso legal es provisional. El nombre de la entidad, la dirección, los datos de registro y la información de contacto se añadirán antes de que el servicio se ponga en marcha.`,
    },
    fr: {
      title: 'Mentions légales',
      body: `## Texte provisoire
Ces mentions légales sont provisoires. La dénomination de l’entité, l’adresse, les informations d’immatriculation et les coordonnées seront ajoutées avant la mise en service.`,
    },
  },
}
