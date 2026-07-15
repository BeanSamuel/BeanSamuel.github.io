import SectionViewer from '../components/SectionViewer';
import { PublicationList } from '../components/Lists';
import { publications } from '../data/resumeData';

// Honors & Awards moved to the Experience page — they belong with education
// and work history, not with papers.
const Research = () => {
  return (
    <div>
      <SectionViewer title="Publications">
        <PublicationList data={publications} />
      </SectionViewer>
    </div>
  );
};

export default Research;
