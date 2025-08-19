"use client";

import * as React from "react";
import { Home, Users, Search, Brain, X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	className?: string;
}

interface NavItem {
	title: string;
	icon: React.ComponentType<{ className?: string }>;
	href: string;
	badge?: string;
}

const navigation: NavItem[] = [
	{ title: "Knowledge Search", icon: Search, href: "/search" },
	{ title: "Brain View", icon: Brain, href: "/topics" },
	{ title: "People", icon: Users, href: "/people" },
	{ title: "Setup", icon: Wrench, href: "/setup" },
];

export function AppSidebar({ open, onOpenChange, className }: AppSidebarProps) {
	return (
		<>
			{/* Mobile overlay */}
			{open && (
				<div
					className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
					onClick={() => onOpenChange(false)}
				/>
			)}

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 w-72 transform border-r bg-card transition-transform duration-200 ease-in-out sm:w-64 lg:static lg:translate-x-0 lg:w-64",
					open ? "translate-x-0" : "-translate-x-full",
					className,
				)}
			>
				<div className="flex h-full flex-col">
					{/* Mobile close button */}
					<div className="flex h-16 items-center justify-between px-4 lg:hidden">
						<span className="text-lg font-semibold">Menu</span>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onOpenChange(false)}
						>
							<X className="h-5 w-5" />
							<span className="sr-only">Close menu</span>
						</Button>
					</div>

					{/* Navigation */}
					<nav className="flex-1 space-y-1 px-2 py-4 lg:py-6">
						{navigation.map((item) => {
							const Icon = item.icon;
							return (
								<a
									key={item.title}
									href={item.href}
									className={cn(
										"group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
										"text-muted-foreground hover:bg-accent hover:text-accent-foreground",
										"focus:bg-accent focus:text-accent-foreground focus:outline-none",
									)}
									onClick={() => onOpenChange(false)}
								>
									<Icon className="mr-3 h-5 w-5 flex-shrink-0" />
									<span className="flex-1">{item.title}</span>
									{item.badge && (
										<span className="ml-3 inline-block py-0.5 px-2 text-xs rounded-full bg-primary text-primary-foreground">
											{item.badge}
										</span>
									)}
								</a>
							);
						})}
					</nav>

					{/* Footer */}
					<div className="border-t p-4">
						<div className="flex items-center space-x-3">
							<div className="h-8 w-8 rounded-full bg-muted" />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-foreground truncate">
									John Doe
								</p>
								<p className="text-xs text-muted-foreground truncate">
									john@example.com
								</p>
							</div>
						</div>
					</div>
				</div>
			</aside>
		</>
	);
}
