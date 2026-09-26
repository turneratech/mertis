/**
 * Example Mertis plugin — copy to server/plugins/ and customize.
 * Plugins receive all webhook events and can push data to external databases.
 *
 * @see docs/DEPLOYMENT.md
 */

module.exports = {
  name: 'example-webhook-logger',
  description: 'Logs webhook events to console (remove in production)',

  async onEvent(event, data) {
    if (event === 'connection.test') return;
    console.log(`[Plugin:example] ${event}`, JSON.stringify(data).slice(0, 200));
  }
};
