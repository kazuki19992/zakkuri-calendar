const { withPlugins, withEntitlementsPlist } = require('@expo/config-plugins');

/** Modは登録順の逆で実行されるため、公式pluginより先に登録して最終結果からAPNs権限を除く。 */
module.exports = function withLocalNotifications(config) {
  config = withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
  return withPlugins(config, [
    ['expo-notifications', { enableBackgroundRemoteNotifications: false }],
  ]);
};
