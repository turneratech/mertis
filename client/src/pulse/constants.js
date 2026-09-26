export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened'];

export const COLUMN_STATION = {
  Open: 'dev_queue',
  Reopened: 'dev_queue',
  'In Progress': 'dev',
  Resolved: 'qa',
  Closed: null
};

export const STATION_LABELS = {
  dev_queue: 'Dev queue',
  dev: 'Dev',
  qa: 'QA',
  qa_testing: 'QA testing'
};

export const LINE_STATIONS = ['dev_queue', 'dev', 'qa', 'qa_testing'];
