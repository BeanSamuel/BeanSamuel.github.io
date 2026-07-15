import SectionViewer from '../components/SectionViewer';
import { ExperienceList, EducationList, GeneralList } from '../components/Lists';
import { experience, education, awards } from '../data/resumeData';

const Experience = () => {
  return (
    <div>
      <SectionViewer title="Experience">
        <ExperienceList data={experience} />
      </SectionViewer>

      <SectionViewer title="Education">
        <EducationList data={education} />
      </SectionViewer>

      <SectionViewer title="Honors & Awards">
        <GeneralList data={awards} />
      </SectionViewer>
    </div>
  );
};

export default Experience;
