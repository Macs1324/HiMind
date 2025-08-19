"use client";

import * as React from "react";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightswitch } from "@/components/ui/lightswitch";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
	onMenuClick?: () => void;
	className?: string;
}

export function AppHeader({ onMenuClick, className }: AppHeaderProps) {
	return (
		<header
			className={cn(
				"sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
				className,
			)}
		>
			<div className="flex h-16 items-center px-3 sm:px-6 lg:px-8">
				{/* Mobile menu button */}
				<Button
					variant="ghost"
					size="icon"
					className="mr-2 lg:hidden"
					onClick={onMenuClick}
				>
					<Menu className="h-5 w-5" />
					<span className="sr-only">Toggle menu</span>
				</Button>

				{/* Logo/Brand */}
				<div className="mr-4 flex items-center space-x-2 sm:mr-6">
					<span className="hidden font-bold sm:inline-block">
						HiMind
					</span>
				</div>

				{/* Actions */}
				<div className="ml-auto flex items-center space-x-1 sm:space-x-2">
					{/* Mobile search button */}
					<Button variant="ghost" size="icon" className="sm:hidden">
						<Search className="h-5 w-5" />
						<span className="sr-only">Search</span>
					</Button>

					<Lightswitch />
				</div>
			</div>
		</header>
	);
}
