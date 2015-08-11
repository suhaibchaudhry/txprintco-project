<?php
//declare(ticks = 1);
register_shutdown_function("saveDumpOnExit");

//function sig_handler() {
//	exit(1);
//}

function saveDumpOnExit() {
	global $dump_config;
	var_dump('Test Test');
}

//pcntl_signal(SIGTERM, "sig_handler");
//pcntl_signal(SIGINT, "sig_handler");
//pcntl_signal(SIGHUP, "sig_handler");

while(1) {
	tet();
}
