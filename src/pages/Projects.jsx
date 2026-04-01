import React from 'react';
import SectionViewer from '../components/SectionViewer';
import { GeneralList } from '../components/Lists';
import { projects } from '../data/resumeData';

const Projects = () => {
  return (
    <div>
      <SectionViewer title="Projects">
        <GeneralList data={projects} />
      </SectionViewer>
    </div>
  );
};

export default Projects;
