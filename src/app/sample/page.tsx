import { protectRoute } from "@/lib/auth-utils";
import { can } from "@/lib/can";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
    // Protect this route - only admin and internal users allowed
    const session = await protectRoute(["admin", "internal"]);

    // Use the can utility for cleaner permission checks
    const userCan = can(session);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <form action={async () => {
                            "use server";
                            await signOut();
                        }}>
                            <Button type="submit" variant="outline">
                                Sign Out
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    {/* Welcome Section */}
                    <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
                        <div className="px-4 py-5 sm:p-6">
                            <h2 className="text-lg font-medium text-gray-900 mb-2">
                                Welcome, {session.user.name}!
                            </h2>
                            <div className="text-sm text-gray-600">
                                <p>Email: {session.user.email}</p>
                                <p>Role: <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${userCan.isAdmin ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                    {session.user.role?.name}
                                </span></p>
                                <p>Status: <span className="text-green-600">Active</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Permissions Section */}
                    <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Your Permissions</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 ${userCan.viewUsers ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                        <span className={userCan.viewUsers ? 'text-gray-900' : 'text-gray-500'}>View Users</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 ${userCan.createUsers ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                        <span className={userCan.createUsers ? 'text-gray-900' : 'text-gray-500'}>Create Users</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 ${userCan.editUsers ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                        <span className={userCan.editUsers ? 'text-gray-900' : 'text-gray-500'}>Edit Users</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 ${userCan.deleteUsers ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                        <span className={userCan.deleteUsers ? 'text-gray-900' : 'text-gray-500'}>Delete Users</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 ${userCan.disableUsers ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                        <span className={userCan.disableUsers ? 'text-gray-900' : 'text-gray-500'}>Disable Users</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {userCan.viewUsers && (
                                    <Button className="w-full justify-start" variant="outline">
                                        👥 View Users
                                    </Button>
                                )}
                                {userCan.createUsers && (
                                    <Button className="w-full justify-start" variant="outline">
                                        ➕ Create User
                                    </Button>
                                )}
                                {userCan.isAdmin && (
                                    <Button className="w-full justify-start" variant="outline">
                                        ⚙️ Settings
                                    </Button>
                                )}
                                <Button className="w-full justify-start" variant="outline">
                                    📊 Reports
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Debug Info (only for admins) */}
                    {userCan.isAdmin && (
                        <div className="bg-gray-100 overflow-hidden shadow rounded-lg mt-6">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Debug Info (Admin Only)</h3>
                                <pre className="text-xs bg-white p-4 rounded border overflow-auto">
                                    {JSON.stringify({
                                        user: userCan.user,
                                        role: userCan.role,
                                        permissions: userCan.permissions
                                    }, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}