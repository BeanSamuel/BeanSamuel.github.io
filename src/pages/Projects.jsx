import React from 'react';
import SectionViewer from '../components/SectionViewer';
import { ProjectList } from '../components/Lists';
import { projects } from '../data/resumeData';

const Projects = () => {
  return (
    <div>
      <SectionViewer title="Projects">
        <ProjectList data={projects} />
      </SectionViewer>
    </div>
  );
};

export default Projects;
