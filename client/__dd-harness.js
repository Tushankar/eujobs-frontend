import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './src/styles/variables.css'
import './src/styles/globals.css'
import act from './src/features/admin/analytics/components/ActivityCard.module.css'
import plat from './src/features/admin/overview/components/PlatformActivityCard.module.css'
import mom from './src/features/recruiter/overview/components/HiringMomentumCard.module.css'
import fj from './src/features/candidate/jobs/pages/FindJobsPage.module.css'
import ss from './src/features/recruiter/find-candidates/components/SortSelect.module.css'
import st from './src/features/recruiter/hiring-pipeline/components/StageSelect.module.css'
import ms from './src/features/recruiter/hiring-pipeline/components/ManageStagesModal.module.css'
import lp from './src/components/layout/LanguagePicker.module.css'
import f from './src/components/ui/Field.module.css'
const chev = (size, cls = '') => `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`
const opts = (list) => list.map((x) => `<option value="${x}">${x}</option>`).join('')
const P = opts(['Last 7 days', 'Last 30 days', 'Last 12 months'])
document.getElementById('h').innerHTML = `
<div style="display:flex;flex-direction:column;gap:22px;align-items:flex-start">
<label id="t1" class="${act.select}"><select name="period">${P}</select>${chev(10, act.chevron)}</label>
<label id="t2" class="${plat.period}"><select class="${plat.select}">${P}</select>${chev(10, plat.chevron)}</label>
<label id="t3" class="${mom.period}"><select class="${mom.select}">${P}</select>${chev(10, mom.chevron)}</label>
<label id="t4" class="${fj.sort}"><select>${opts(['Most recent', 'Recommended', 'Salary'])}</select>${chev(11)}</label>
<div id="t5" class="${ss.root}"><select class="${ss.select}">${opts(['Best match', 'Newest'])}</select>${chev(12, ss.chevron)}</div>
<span id="t6" class="${st.root} ${st.table}" style="width:180px"><select class="${st.select}">${opts(['Applied', 'Screening', 'Interview', 'Offer'])}</select>${chev(16, st.chevron)}</span>
<div id="t7" class="${ms.row}"><select class="${ms.category}">${opts(['In review (screening)', 'Interview'])}</select></div>
<label id="t8" class="${lp.language}"><select>${opts(['English', 'Español', 'Français'])}</select></label>
<div id="t9" style="width:220px" class="${f.control}"><select class="${f.input}"><option value="" disabled selected>Month</option>${opts(['January', 'February'])}</select><span class="${f.trailing}">${chev(14)}</span></div>
<div id="t10" style="width:260px" class="${f.control}"><select class="${f.input}">${opts(['Senior Full-stack Developer at Kyptronix LLP London'])}</select><span class="${f.trailing}">${chev(14)}</span></div>
</div>`
