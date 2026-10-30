import styles from './JobPosting.module.css'

function SkillGroup({ title, skills }) {
  if (!skills?.length) return null
  return (
    <>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.skills}>
        {skills.map((skill) => (
          <li key={skill} className={styles.skill}>
            {skill}
          </li>
        ))}
      </ul>
    </>
  )
}

/** The body of a job posting (brief, responsibilities, skills); shared by Job details and the wizard preview. */
export default function JobPosting({ job }) {
  return (
    <>
      <p className={styles.brief}>{job.description || 'No brief has been added yet. Use Edit role to add one.'}</p>
      {job.responsibilities?.length > 0 && (
        <>
          <h3 className={styles.heading}>Responsibilities</h3>
          <ul className={styles.responsibilities}>
            {job.responsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <SkillGroup title="Required skills" skills={job.requiredSkills} />
      <SkillGroup title="Preferred skills" skills={job.preferredSkills} />
    </>
  )
}
