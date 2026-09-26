const stationForStatus = (status) => {
  if (status === 'Open' || status === 'Reopened') return 'dev_queue';
  if (status === 'In Progress') return 'dev';
  if (status === 'Resolved') return 'qa';
  if (status === 'Closed') return 'closed';
  return 'dev';
};

const buildStatusChange = (fromStatus, toStatus) => ({
  action: 'status_change',
  from: fromStatus,
  to: toStatus,
  station: stationForStatus(toStatus),
  message: `${fromStatus} → ${toStatus}`
});

module.exports = { stationForStatus, buildStatusChange };
