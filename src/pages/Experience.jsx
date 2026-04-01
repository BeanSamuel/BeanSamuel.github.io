import React from 'react';
import SectionViewer from '../components/SectionViewer';
import { ExperienceList, EducationList } from '../components/Lists';
import { experience, education } from '../data/resumeData';

const Experience = () => {
  return (
    <div>
      <SectionViewer title="Experience">
        <ExperienceList data={experience} />
      </SectionViewer>

      <SectionViewer title="Education">
        <EducationList data={education} />
      </SectionViewer>
    </div>
  );
};

export default Experience;
