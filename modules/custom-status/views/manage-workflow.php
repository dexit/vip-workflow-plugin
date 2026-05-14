<?php
defined( 'ABSPATH' ) || exit();
?>
<div class="wrap vip-workflow-admin">
	<div class="explanation">
		<h3><?php esc_html_e( 'API Workflow Builder', 'vip-workflow' ); ?></h3>
		<p><?php esc_html_e( 'Design your API ingestion and despatch workflow by defining steps and assigning components to them.', 'vip-workflow' ); ?></p>
	</div>

	<div id="endpoint-config-root" style="margin-bottom: 30px;"></div>
	<div id="workflow-manager-root"></div>
</div>
