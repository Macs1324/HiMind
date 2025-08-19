"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
	Users,
	Plus,
	Edit,
	Link,
	Github,
	MessageSquare,
	Trash2,
	Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Person {
	id: string;
	display_name: string;
	email: string;
	role: string;
	is_active: boolean;
	created_at: string;
	external_identities?: ExternalIdentity[];
}

interface ExternalIdentity {
	id: string;
	platform: string;
	external_id: string;
	username: string;
}

interface NewPerson {
	display_name: string;
	email: string;
	role: string;
	slack_id?: string;
	slack_username?: string;
	github_id?: string;
	github_username?: string;
}

export function PeopleManagement() {
	const [people, setPeople] = useState<Person[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

	const [newPerson, setNewPerson] = useState<NewPerson>({
		display_name: "",
		email: "",
		role: "member",
	});

	useEffect(() => {
		fetchPeople();
	}, []);

	const fetchPeople = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/people");
			if (response.ok) {
				const data = await response.json();
				setPeople(data.people || []);
			}
		} catch (error) {
			console.error("Failed to fetch people:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleAddPerson = async () => {
		try {
			const response = await fetch("/api/people", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newPerson),
			});

			if (response.ok) {
				setIsAddDialogOpen(false);
				setNewPerson({
					display_name: "",
					email: "",
					role: "member",
				});
				await fetchPeople();
			}
		} catch (error) {
			console.error("Failed to add person:", error);
		}
	};

	const handleUpdatePerson = async () => {
		if (!selectedPerson) return;

		try {
			const response = await fetch(`/api/people/${selectedPerson.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(selectedPerson),
			});

			if (response.ok) {
				setIsEditDialogOpen(false);
				setSelectedPerson(null);
				await fetchPeople();
			}
		} catch (error) {
			console.error("Failed to update person:", error);
		}
	};

	const handleDeletePerson = async (personId: string) => {
		if (!confirm("Are you sure you want to delete this person?")) return;

		try {
			const response = await fetch(`/api/people/${personId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				await fetchPeople();
			}
		} catch (error) {
			console.error("Failed to delete person:", error);
		}
	};

	const filteredPeople = people.filter(
		(person) =>
			person.display_name
				.toLowerCase()
				.includes(searchTerm.toLowerCase()) ||
			person.email.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const getPlatformIcon = (platform: string) => {
		switch (platform) {
			case "slack":
				return <MessageSquare className="h-4 w-4" />;
			case "github":
				return <Github className="h-4 w-4" />;
			default:
				return <Link className="h-4 w-4" />;
		}
	};

	const getRoleColor = (role: string) => {
		switch (role) {
			case "admin":
				return "destructive";
			case "member":
				return "default";
			case "readonly":
				return "secondary";
			default:
				return "outline";
		}
	};

	if (loading) {
		return <div>Loading people...</div>;
	}

	return (
		<div className="space-y-6 sm:space-y-8">
			{/* Summary Cards */}
			<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total People
						</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{people.length}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Active Members
						</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{people.filter((p) => p.is_active).length}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Linked Identities
						</CardTitle>
						<Link className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{people.reduce(
								(total, person) =>
									total +
									(person.external_identities?.length || 0),
								0,
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Search and Add */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Team Members</CardTitle>
						<Dialog
							open={isAddDialogOpen}
							onOpenChange={setIsAddDialogOpen}
						>
							<DialogTrigger asChild>
								<Button>
									<Plus className="mr-2 h-4 w-4" />
									Add Person
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>Add New Person</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<div>
										<label className="text-sm font-medium">
											Email
										</label>
										<Input
											type="email"
											value={newPerson.email}
											onChange={(e) =>
												setNewPerson({
													...newPerson,
													email: e.target.value,
												})
											}
											placeholder="john@company.com"
										/>
									</div>
									<div>
										<label className="text-sm font-medium">
											Role
										</label>
										<Select
											value={newPerson.role}
											onValueChange={(value) =>
												setNewPerson({
													...newPerson,
													role: value,
												})
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="admin">
													Admin
												</SelectItem>
												<SelectItem value="member">
													Member
												</SelectItem>
												<SelectItem value="readonly">
													Read Only
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div>
										<label className="text-sm font-medium">
											Slack Username (Optional)
										</label>
										<Input
											value={
												newPerson.slack_username || ""
											}
											onChange={(e) =>
												setNewPerson({
													...newPerson,
													slack_username:
														e.target.value,
												})
											}
											placeholder="@john.doe"
										/>
									</div>
									<div>
										<label className="text-sm font-medium">
											GitHub Username (Optional)
										</label>
										<Input
											value={
												newPerson.github_username || ""
											}
											onChange={(e) =>
												setNewPerson({
													...newPerson,
													github_username:
														e.target.value,
												})
											}
											placeholder="johndoe"
										/>
									</div>
									<Button
										onClick={handleAddPerson}
										className="w-full"
									>
										Add Person
									</Button>
								</div>
							</DialogContent>
						</Dialog>
					</div>
					<div className="relative max-w-sm">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search people..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10"
							aria-label="Search people"
						/>
					</div>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Linked Platforms</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredPeople.map((person) => (
								<TableRow key={person.id}>
									<TableCell className="font-medium">
										{person.display_name}
									</TableCell>
									<TableCell>{person.email}</TableCell>
									<TableCell>
										<Badge
											variant={getRoleColor(person.role)}
										>
											{person.role}
										</Badge>
									</TableCell>
									<TableCell>
										<div className="flex space-x-1">
											{person.external_identities?.map(
												(identity) => (
													<Badge
														key={identity.id}
														variant="outline"
														className="flex items-center space-x-1"
													>
														{getPlatformIcon(
															identity.platform,
														)}
														<span className="text-xs">
															{identity.username ||
																identity.external_id}
														</span>
													</Badge>
												),
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant={
												person.is_active
													? "default"
													: "secondary"
											}
										>
											{person.is_active
												? "Active"
												: "Inactive"}
										</Badge>
									</TableCell>
									<TableCell>
										<div className="flex space-x-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													setSelectedPerson(person);
													setIsEditDialogOpen(true);
												}}
												aria-label={`Edit ${person.display_name}`}
											>
												<Edit className="h-4 w-4" />
												<span className="sr-only">
													Edit
												</span>
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleDeletePerson(
														person.id,
													)
												}
												aria-label={`Delete ${person.display_name}`}
											>
												<Trash2 className="h-4 w-4" />
												<span className="sr-only">
													Delete
												</span>
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Edit Person Dialog */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Edit Person</DialogTitle>
					</DialogHeader>
					{selectedPerson && (
						<div className="space-y-4">
							<div>
								<label className="text-sm font-medium">
									Display Name
								</label>
								<Input
									value={selectedPerson.display_name}
									onChange={(e) =>
										setSelectedPerson({
											...selectedPerson,
											display_name: e.target.value,
										})
									}
								/>
							</div>
							<div>
								<label className="text-sm font-medium">
									Email
								</label>
								<Input
									type="email"
									value={selectedPerson.email}
									onChange={(e) =>
										setSelectedPerson({
											...selectedPerson,
											email: e.target.value,
										})
									}
								/>
							</div>
							<div>
								<label className="text-sm font-medium">
									Role
								</label>
								<Select
									value={selectedPerson.role}
									onValueChange={(value) =>
										setSelectedPerson({
											...selectedPerson,
											role: value,
										})
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="admin">
											Admin
										</SelectItem>
										<SelectItem value="member">
											Member
										</SelectItem>
										<SelectItem value="readonly">
											Read Only
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center space-x-2">
								<input
									type="checkbox"
									id="is_active"
									checked={selectedPerson.is_active}
									onChange={(e) =>
										setSelectedPerson({
											...selectedPerson,
											is_active: e.target.checked,
										})
									}
								/>
								<label
									htmlFor="is_active"
									className="text-sm font-medium"
								>
									Active
								</label>
							</div>
							<Button
								onClick={handleUpdatePerson}
								className="w-full"
							>
								Update Person
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
