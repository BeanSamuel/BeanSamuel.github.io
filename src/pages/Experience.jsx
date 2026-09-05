import SectionViewer from '../components/SectionViewer';
import { ExperienceList, EducationList } from '../components/Lists';
import CertificateList from '../components/CertificateList';
import { experience, education, awards, outreach } from '../data/resumeData';

const Experience = () => {
  return (
    <div>
      <SectionViewer title="Experience">
        <ExperienceList data={experience} />
      </SectionViewer>

      <SectionViewer title="Education">
        <EducationList data={education} />
      </SectionViewer>

      <SectionViewer title="Teaching & Outreach">
        <CertificateList data={outreach} label="證書" />
      </SectionViewer>

      <SectionViewer title="Honors & Awards">
        <CertificateList data={awards} />
      </SectionViewer>
    </div>
  );
};

export default Experience;
