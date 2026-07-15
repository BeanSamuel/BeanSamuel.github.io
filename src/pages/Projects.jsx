import SectionViewer from '../components/SectionViewer';
import { ProjectList, WritingList } from '../components/Lists';
import { projects, writings } from '../data/resumeData';

const Projects = () => {
  return (
    <div>
      <SectionViewer title="Projects">
        <ProjectList data={projects} />
      </SectionViewer>

      <SectionViewer title="Writing">
        <WritingList data={writings} />
      </SectionViewer>
    </div>
  );
};

export default Projects;
