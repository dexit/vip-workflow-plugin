<?php
namespace VIPWorkflow\Modules\Shared\PHP;

class InstallUtilities {
	public static function install_if_first_run(  ): void {
		if ( get_option( 'vip_workflow_installed' ) ) return;
		call_user_func(  );
		update_option( 'vip_workflow_installed', time() );
	}
	public static function is_first_install(): bool {
		return ! get_option( 'vip_workflow_installed' );
	}
}
