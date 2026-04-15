import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Bell, Shield, Palette, Database } from "lucide-react"

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-[#EAECEF]">Configuración</h1>
                <p className="text-[#848E9C] mt-2">
                    Administra las preferencias de tu cuenta y aplicación
                </p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="bg-[#2B3139] border-b border-[#474D57]">
                    <TabsTrigger
                        value="profile"
                        className="data-[state=active]:bg-[#F0B90B] data-[state=active]:text-[#0B0E11] text-[#848E9C]"
                    >
                        <User className="w-4 h-4 mr-2" />
                        Perfil
                    </TabsTrigger>
                    <TabsTrigger
                        value="notifications"
                        className="data-[state=active]:bg-[#F0B90B] data-[state=active]:text-[#0B0E11] text-[#848E9C]"
                    >
                        <Bell className="w-4 h-4 mr-2" />
                        Notificaciones
                    </TabsTrigger>
                    <TabsTrigger
                        value="security"
                        className="data-[state=active]:bg-[#F0B90B] data-[state=active]:text-[#0B0E11] text-[#848E9C]"
                    >
                        <Shield className="w-4 h-4 mr-2" />
                        Seguridad
                    </TabsTrigger>
                    <TabsTrigger
                        value="appearance"
                        className="data-[state=active]:bg-[#F0B90B] data-[state=active]:text-[#0B0E11] text-[#848E9C]"
                    >
                        <Palette className="w-4 h-4 mr-2" />
                        Apariencia
                    </TabsTrigger>
                    <TabsTrigger
                        value="integrations"
                        className="data-[state=active]:bg-[#F0B90B] data-[state=active]:text-[#0B0E11] text-[#848E9C]"
                    >
                        <Database className="w-4 h-4 mr-2" />
                        Integraciones
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="mt-6">
                    <Card className="bg-[#1E2329] border-[#2B3139]">
                        <CardHeader>
                            <CardTitle className="text-[#EAECEF]">Información del Perfil</CardTitle>
                            <CardDescription className="text-[#848E9C]">
                                Actualiza tu información personal
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName" className="text-[#EAECEF]">Nombre</Label>
                                    <Input
                                        id="firstName"
                                        placeholder="Juan"
                                        className="bg-[#2B3139] border-[#474D57] text-[#EAECEF] placeholder:text-[#848E9C]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName" className="text-[#EAECEF]">Apellido</Label>
                                    <Input
                                        id="lastName"
                                        placeholder="Pérez"
                                        className="bg-[#2B3139] border-[#474D57] text-[#EAECEF] placeholder:text-[#848E9C]"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-[#EAECEF]">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="juan@ejemplo.com"
                                    className="bg-[#2B3139] border-[#474D57] text-[#EAECEF] placeholder:text-[#848E9C]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company" className="text-[#EAECEF]">Empresa</Label>
                                <Input
                                    id="company"
                                    placeholder="Mi Empresa S.A.S"
                                    className="bg-[#2B3139] border-[#474D57] text-[#EAECEF] placeholder:text-[#848E9C]"
                                />
                            </div>
                            <Button className="bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-[#0B0E11] font-bold">
                                Guardar Cambios
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="mt-6">
                    <Card className="bg-[#1E2329] border-[#2B3139]">
                        <CardHeader>
                            <CardTitle className="text-[#EAECEF]">Preferencias de Notificaciones</CardTitle>
                            <CardDescription className="text-[#848E9C]">
                                Configura cómo y cuándo recibir notificaciones
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[#2B3139] rounded-lg">
                                <div>
                                    <p className="text-[#EAECEF] font-medium">Alertas de Ventas</p>
                                    <p className="text-[#848E9C] text-sm">Recibe notificaciones de nuevas ventas</p>
                                </div>
                                <input type="checkbox" className="w-5 h-5" defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[#2B3139] rounded-lg">
                                <div>
                                    <p className="text-[#EAECEF] font-medium">Reportes Semanales</p>
                                    <p className="text-[#848E9C] text-sm">Resumen semanal de métricas</p>
                                </div>
                                <input type="checkbox" className="w-5 h-5" defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[#2B3139] rounded-lg">
                                <div>
                                    <p className="text-[#EAECEF] font-medium">Actualizaciones del Sistema</p>
                                    <p className="text-[#848E9C] text-sm">Notificaciones de nuevas funciones</p>
                                </div>
                                <input type="checkbox" className="w-5 h-5" />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <Card className="bg-[#1E2329] border-[#2B3139]">
                        <CardHeader>
                            <CardTitle className="text-[#EAECEF]">Seguridad</CardTitle>
                            <CardDescription className="text-[#848E9C]">
                                Administra la seguridad de tu cuenta
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword" className="text-[#EAECEF]">Contraseña Actual</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    className="bg-[#2B3139] border-[#474D57] text-[#EAECEF]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-[#EAECEF]">Nueva Contraseña</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    className="bg-[#2B3139] border-[#474D57] text-[#EAECEF]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-[#EAECEF]">Confirmar Contraseña</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    className="bg-[#2B3139] border-[#474D57] text-[#EAECEF]"
                                />
                            </div>
                            <Button className="bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-[#0B0E11] font-bold">
                                Actualizar Contraseña
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="appearance" className="mt-6">
                    <Card className="bg-[#1E2329] border-[#2B3139]">
                        <CardHeader>
                            <CardTitle className="text-[#EAECEF]">Apariencia</CardTitle>
                            <CardDescription className="text-[#848E9C]">
                                Personaliza la apariencia de la aplicación
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[#EAECEF]">Tema</Label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-[#2B3139] rounded-lg border-2 border-[#F0B90B] cursor-pointer">
                                        <p className="text-[#EAECEF] font-medium">Oscuro</p>
                                        <p className="text-[#848E9C] text-sm">Tema actual</p>
                                    </div>
                                    <div className="p-4 bg-[#2B3139] rounded-lg border-2 border-transparent hover:border-[#474D57] cursor-pointer opacity-50">
                                        <p className="text-[#EAECEF] font-medium">Claro</p>
                                        <p className="text-[#848E9C] text-sm">Próximamente</p>
                                    </div>
                                    <div className="p-4 bg-[#2B3139] rounded-lg border-2 border-transparent hover:border-[#474D57] cursor-pointer opacity-50">
                                        <p className="text-[#EAECEF] font-medium">Auto</p>
                                        <p className="text-[#848E9C] text-sm">Próximamente</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="integrations" className="mt-6">
                    <Card className="bg-[#1E2329] border-[#2B3139]">
                        <CardHeader>
                            <CardTitle className="text-[#EAECEF]">Integraciones</CardTitle>
                            <CardDescription className="text-[#848E9C]">
                                Conecta con servicios externos
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[#2B3139] rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#F0B90B] rounded-lg flex items-center justify-center">
                                        <Database className="w-6 h-6 text-[#0B0E11]" />
                                    </div>
                                    <div>
                                        <p className="text-[#EAECEF] font-medium">Siigo</p>
                                        <p className="text-[#848E9C] text-sm">Sistema de facturación</p>
                                    </div>
                                </div>
                                <Button className="bg-[#0ECB81] hover:bg-[#0ECB81]/90 text-[#0B0E11] font-bold">
                                    Conectado
                                </Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[#2B3139] rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#474D57] rounded-lg flex items-center justify-center">
                                        <Database className="w-6 h-6 text-[#848E9C]" />
                                    </div>
                                    <div>
                                        <p className="text-[#EAECEF] font-medium">Looker Studio</p>
                                        <p className="text-[#848E9C] text-sm">Visualización de datos</p>
                                    </div>
                                </div>
                                <Button className="bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-[#0B0E11] font-bold">
                                    Configurar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
