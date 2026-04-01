import React from 'react';
import SectionViewer from '../components/SectionViewer';
import { PublicationList, GeneralList } from '../components/Lists';
import { publications, awards } from '../data/resumeData';

const Publications = () => {
  return (
    <div>
      <SectionViewer title="Publications">
        <PublicationList data={publications} />
      </SectionViewer>

      <SectionViewer title="Honors & Awards">
        <GeneralList data={awards} />
      </SectionViewer>
    </div>
  );
};

export default Publications;
